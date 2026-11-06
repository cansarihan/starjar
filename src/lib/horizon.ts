import { CONFIG, type TokenInfo } from "@/lib/config";

interface Balance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

/** Classic balances for an account, or null when it does not exist yet. */
export async function balances(account: string): Promise<Balance[] | null> {
  const res = await fetch(`${CONFIG.horizonUrl}/accounts/${account}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`horizon ${res.status}`);
  return ((await res.json()) as { balances: Balance[] }).balances;
}

/** Whether the account can hold `token`: always for XLM, with a trustline otherwise. */
export function canHold(list: Balance[] | null, token: TokenInfo): boolean {
  if (!list) return false;
  if (!token.classic) return true;
  return list.some((b) => b.asset_code === token.classic!.code && b.asset_issuer === token.classic!.issuer);
}

export function balanceOf(list: Balance[] | null, token: TokenInfo): string | null {
  if (!list) return null;
  const b = token.classic
    ? list.find((x) => x.asset_code === token.classic!.code && x.asset_issuer === token.classic!.issuer)
    : list.find((x) => x.asset_type === "native");
  return b?.balance ?? null;
}
