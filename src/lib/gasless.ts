import { TransactionBuilder, type xdr } from "@stellar/stellar-sdk";

import { CONFIG } from "@/lib/config";
import { explainContractError } from "@/lib/errors";
import { server } from "@/lib/soroban";
import { signWithWallet } from "@/lib/wallet";

export interface SponsoredResult {
  hash: string;
  result: unknown;
}

export class SponsorError extends Error {
  constructor(
    message: string,
    readonly hash?: string,
  ) {
    super(message);
  }
}

/**
 * Build one contract call for `address`, let RPC fill in its resources, have
 * the wallet sign it, and hand it to the sponsor. The wallet shows the user
 * exactly the call they are authorising; the fee line it shows is never charged
 * to them, because the sponsor wraps it.
 */
export async function sendSponsored(address: string, op: xdr.Operation): Promise<SponsoredResult> {
  const rpcServer = server();
  let account;
  try {
    account = await rpcServer.getAccount(address);
  } catch {
    throw new SponsorError(
      CONFIG.network === "mainnet"
        ? "This wallet is not active on Stellar yet. It needs a small XLM balance first."
        : "This wallet is not funded on testnet. Fund it with friendbot first.",
    );
  }

  const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: CONFIG.passphrase })
    .addOperation(op)
    .setTimeout(180)
    .build();

  let prepared;
  try {
    prepared = await rpcServer.prepareTransaction(tx);
  } catch (e) {
    throw new SponsorError(explainContractError(String((e as Error).message ?? e)));
  }

  const signed = await signWithWallet(prepared.toXDR(), address);

  const res = await fetch("/api/sponsor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ xdr: signed }),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; hash?: string; result?: unknown };
  if (!res.ok || !body.ok) throw new SponsorError(body.error ?? `Sponsor returned ${res.status}`, body.hash);
  return { hash: body.hash!, result: body.result };
}
