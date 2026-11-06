import { Keypair, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";

import { CONFIG } from "@/lib/config";
import { explainContractError } from "@/lib/errors";
import { server } from "@/lib/soroban";
import { WindowLimiter } from "@/lib/server/rate-limit";
import { checkEnvelope, type Policy } from "@/lib/server/sponsor-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

const policy: Policy = {
  networkPassphrase: CONFIG.passphrase,
  contractId: CONFIG.contractId,
  functions: ["tip", "register"],
  maxResourceFee: BigInt(process.env.SPONSOR_MAX_RESOURCE_FEE ?? "2000000"),
  maxInclusionFee: 10_000n,
  maxValiditySeconds: 300,
};

const perAccount = new WindowLimiter(Number(process.env.SPONSOR_DAILY_LIMIT_PER_ACCOUNT ?? "25"), DAY);
const perIp = new WindowLimiter(60, 60 * 60 * 1000);
const everyone = new WindowLimiter(600, 60 * 60 * 1000);

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/**
 * Wrap a user-signed contract call in a fee bump paid by the sponsor, submit
 * it, and wait for the result.
 *
 * The user's signature still authorises everything the call does; the sponsor
 * only adds a second envelope around it that says who pays the fee.
 */
export async function POST(req: Request) {
  const secret = process.env.SPONSOR_SECRET;
  if (!secret || !CONFIG.contractId) return fail(503, "Fee sponsorship is not configured");

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 32_000) return fail(413, "Request too large");

  let body: { xdr?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Expected JSON");
  }

  const verdict = checkEnvelope(String(body.xdr ?? ""), policy, Math.floor(Date.now() / 1000));
  if (!verdict.ok) return fail(400, `Not sponsored: ${verdict.reason}`);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!everyone.take("all").ok) return fail(429, "The sponsor is busy. Try again in a few minutes.");
  if (!perIp.take(ip).ok) return fail(429, "Too many sponsored transactions from this network. Try again later.");
  if (!perAccount.take(verdict.source).ok) {
    return fail(429, "Daily limit of sponsored transactions reached for this account.");
  }

  const rpcServer = server();

  // Simulate first. A transaction that fails on chain still costs its fee, so
  // the sponsor only pays for calls that are going to succeed.
  const sim = await rpcServer.simulateTransaction(verdict.tx);
  if (rpc.Api.isSimulationError(sim)) {
    perAccount.refund(verdict.source);
    return fail(400, explainContractError(sim.error));
  }

  const sponsor = Keypair.fromSecret(secret);
  const base = verdict.inclusionFee > 100n ? verdict.inclusionFee.toString() : "100";
  const bump = TransactionBuilder.buildFeeBumpTransaction(sponsor, base, verdict.tx, CONFIG.passphrase);
  bump.sign(sponsor);

  const sent = await rpcServer.sendTransaction(bump);
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    perAccount.refund(verdict.source);
    return fail(502, `Network did not accept the transaction (${sent.status})`);
  }

  const hash = sent.hash;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await rpcServer.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const value = res.returnValue ? scValToNative(res.returnValue) : null;
      return NextResponse.json({
        ok: true,
        hash,
        ledger: res.ledger,
        fn: verdict.fn,
        result: typeof value === "bigint" ? value.toString() : value,
        sponsor: sponsor.publicKey(),
        feeCharged: bump.fee,
      });
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      return NextResponse.json({ ok: false, hash, error: "Transaction failed on chain" }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: false, hash, error: "Still pending. Check the explorer." }, { status: 202 });
}
