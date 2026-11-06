import { Keypair } from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";

import { CONFIG } from "@/lib/config";
import { balances } from "@/lib/horizon";
import { getStats } from "@/lib/soroban";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Below this the sponsor has about a day of fees left at launch traffic. */
const LOW_WATER_XLM = 20;

/**
 * For uptime checks: is the contract readable, and does the sponsor have XLM
 * left to pay fees with. Public, and reveals only public keys and balances.
 */
export async function GET() {
  const secret = process.env.SPONSOR_SECRET;
  const sponsor = secret ? Keypair.fromSecret(secret).publicKey() : null;

  const [stats, sponsorBalances] = await Promise.all([
    getStats().catch(() => null),
    sponsor ? balances(sponsor).catch(() => null) : Promise.resolve(null),
  ]);
  const xlm = Number(sponsorBalances?.find((b) => b.asset_type === "native")?.balance ?? 0);

  const ok = !!stats && !!sponsor && xlm >= LOW_WATER_XLM;
  return NextResponse.json(
    {
      ok,
      network: CONFIG.network,
      contract: CONFIG.contractId,
      contractReadable: !!stats,
      stats,
      sponsor,
      sponsorXlm: xlm,
      sponsorLow: xlm < LOW_WATER_XLM,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
