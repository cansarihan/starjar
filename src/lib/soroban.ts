import {
  Account,
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";

import { CONFIG } from "@/lib/config";

export interface Profile {
  owner: string;
  handle: string;
  name: string;
  bio: string;
  joinedLedger: number;
}

export interface Tip {
  id: number;
  from: string;
  token: string;
  amount: bigint;
  message: string;
  ledger: number;
}

export interface Stats {
  creators: number;
  tips: number;
  tippers: number;
}

export const server = () => new rpc.Server(CONFIG.rpcUrl, { allowHttp: CONFIG.rpcUrl.startsWith("http://") });

/**
 * Reads go through simulation, so they cost nothing and need no account.
 * A throwaway key is the source: simulation does not check that it exists.
 */
async function read(method: string, args: xdr.ScVal[] = []): Promise<unknown> {
  const source = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: CONFIG.passphrase })
    .addOperation(new Contract(CONFIG.contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const retval = sim.result?.retval;
  return retval ? scValToNative(retval) : undefined;
}

const str = (v: string) => nativeToScVal(v, { type: "string" });
const addr = (v: string) => new Address(v).toScVal();

const toProfile = (raw: Record<string, unknown> | undefined | null): Profile | null =>
  raw
    ? {
        owner: String(raw.owner),
        handle: String(raw.handle),
        name: String(raw.name),
        bio: String(raw.bio),
        joinedLedger: Number(raw.joined_ledger),
      }
    : null;

export async function getCreator(handle: string): Promise<Profile | null> {
  return toProfile((await read("creator", [str(handle)])) as Record<string, unknown> | null);
}

export async function getHandleOf(owner: string): Promise<string | null> {
  const h = await read("handle_of", [addr(owner)]);
  return h == null ? null : String(h);
}

export async function getRecent(handle: string): Promise<Tip[]> {
  const raw = ((await read("recent", [str(handle)])) as Record<string, unknown>[] | undefined) ?? [];
  return raw
    .map((t) => ({
      id: Number(t.id),
      from: String(t.from),
      token: String(t.token),
      amount: BigInt(t.amount as bigint),
      message: String(t.message),
      ledger: Number(t.ledger),
    }))
    .reverse();
}

export async function getTotal(handle: string, token: string): Promise<bigint> {
  return BigInt(((await read("total", [str(handle), addr(token)])) as bigint | undefined) ?? 0n);
}

export async function getStats(): Promise<Stats> {
  const s = ((await read("stats")) as Record<string, unknown> | undefined) ?? {};
  return { creators: Number(s.creators ?? 0), tips: Number(s.tips ?? 0), tippers: Number(s.tippers ?? 0) };
}

/** The two writes the app makes, as contract call operations. */
export const ops = {
  register: (owner: string, handle: string, name: string, bio: string) =>
    new Contract(CONFIG.contractId).call("register", addr(owner), str(handle), str(name), str(bio)),

  tip: (from: string, handle: string, token: string, amount: bigint, message: string) =>
    new Contract(CONFIG.contractId).call(
      "tip",
      addr(from),
      str(handle),
      addr(token),
      nativeToScVal(amount, { type: "i128" }),
      str(message),
    ),
};
