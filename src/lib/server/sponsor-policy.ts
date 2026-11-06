import {
  Address,
  FeeBumpTransaction,
  Keypair,
  StrKey,
  TransactionBuilder,
  scValToNative,
  type Transaction,
  type xdr,
} from "@stellar/stellar-sdk";

// The XDR classes in stellar-sdk 17 expose fields as properties and tag unions
// with `type`. These are the few shapes this file reads.
interface InvokeContractArgs {
  contractAddress: xdr.ScAddress;
  functionName: { toString(): string };
  args: xdr.ScVal[];
}
interface EnvelopeV1 {
  v1?: { tx?: { ext?: { type: unknown; sorobanData?: { resourceFee: bigint | string } } } };
}

/** Raw signature bytes from either the v17 value object or an older Buffer. */
const sigBytes = (v: unknown): Uint8Array | null => {
  if (v instanceof Uint8Array) return v;
  const o = v as { toBytes?: () => Uint8Array; value?: unknown } | null;
  if (o && typeof o.toBytes === "function") return o.toBytes();
  if (o?.value instanceof Uint8Array) return o.value;
  return null;
};

/** Union tag as a string, whether the SDK gives a name or an enum value. */
const tag = (u: unknown): string | undefined => {
  const t = (u as { type?: unknown } | undefined)?.type;
  if (typeof t === "string") return t;
  return (t as { name?: string } | undefined)?.name;
};

/**
 * What the sponsor agrees to pay for.
 *
 * The sponsor key pays the fee for any envelope it wraps, so this is the
 * boundary that decides whose transactions cost us money. It is a pure function
 * of the envelope and the clock so it can be tested without a network.
 */
export interface Policy {
  networkPassphrase: string;
  contractId: string;
  /** Contract functions the sponsor will pay for. */
  functions: readonly string[];
  /** Largest Soroban resource fee covered, in stroops. */
  maxResourceFee: bigint;
  /** Largest inclusion fee per operation the inner envelope may bid, in stroops. */
  maxInclusionFee: bigint;
  /**
   * Smallest tip, in the token's raw units, the sponsor pays a fee for.
   * Without it, dust tips turn the sponsor's balance into a free faucet for
   * transaction spam. The contract itself accepts any positive amount.
   */
  minTipAmount: bigint;
  /** The envelope must expire within this many seconds of now. */
  maxValiditySeconds: number;
}

export type Verdict =
  | { ok: true; tx: Transaction; source: string; fn: string; resourceFee: bigint; inclusionFee: bigint }
  | { ok: false; reason: string };

const no = (reason: string): Verdict => ({ ok: false, reason });

export function checkEnvelope(envelopeXdr: string, policy: Policy, nowSeconds: number): Verdict {
  if (typeof envelopeXdr !== "string" || envelopeXdr.length === 0 || envelopeXdr.length > 20_000) {
    return no("envelope missing or too large");
  }

  let parsed: Transaction | FeeBumpTransaction;
  try {
    parsed = TransactionBuilder.fromXDR(envelopeXdr, policy.networkPassphrase);
  } catch {
    return no("envelope is not valid XDR");
  }
  if (parsed instanceof FeeBumpTransaction) return no("already fee-bumped");
  const tx = parsed;

  // A muxed source would let one account look like many to the rate limit.
  if (!StrKey.isValidEd25519PublicKey(tx.source)) return no("source must be a plain G account");

  if (tx.operations.length !== 1) return no("exactly one operation allowed");
  const op = tx.operations[0];
  if (op.type !== "invokeHostFunction") return no("only contract calls are sponsored");
  if (op.source && op.source !== tx.source) return no("operation source must be the transaction source");

  const fn0 = op.func as unknown as { type: unknown; invokeContract?: InvokeContractArgs };
  if (tag(fn0) !== "hostFunctionTypeInvokeContract" || !fn0.invokeContract) {
    return no("only contract calls are sponsored");
  }
  const call = fn0.invokeContract;

  let target: string;
  try {
    target = Address.fromScAddress(call.contractAddress).toString();
  } catch {
    return no("unreadable contract address");
  }
  if (target !== policy.contractId) return no("not the StarJar contract");

  const fn = call.functionName.toString();
  if (!policy.functions.includes(fn)) return no(`function ${fn} is not sponsored`);

  // The acting address (first argument) must be the account that signed the
  // envelope. Then every authorisation comes from that one signature and the
  // sponsor is only ever paying for someone acting on their own behalf.
  let actor: string;
  try {
    actor = Address.fromScVal(call.args[0]).toString();
  } catch {
    return no("first argument must be an address");
  }
  if (actor !== tx.source) return no("caller must be the transaction source");

  for (const entry of (op.auth ?? []) as unknown as { credentials: { type: unknown } }[]) {
    if (tag(entry.credentials) !== "sorobanCredentialsSourceAccount") {
      return no("only source-account authorisation is sponsored");
    }
  }

  if (fn === "tip") {
    let amount: bigint;
    try {
      amount = BigInt(scValToNative(call.args[3]) as bigint);
    } catch {
      return no("unreadable tip amount");
    }
    if (amount < policy.minTipAmount) return no("tip below the sponsored minimum");
  }

  const ext = (tx.toEnvelope() as unknown as EnvelopeV1).v1?.tx?.ext;
  const resourceFeeRaw = tag(ext) === "sorobanData" ? ext?.sorobanData?.resourceFee : undefined;
  if (resourceFeeRaw === undefined) return no("envelope was not prepared (no Soroban resources)");
  const resourceFee = BigInt(resourceFeeRaw.toString());
  if (resourceFee > policy.maxResourceFee) return no("resource fee above the sponsor cap");

  const inclusionFee = BigInt(tx.fee) - resourceFee;
  if (inclusionFee < 0n) return no("fee lower than its own resource fee");
  if (inclusionFee > policy.maxInclusionFee) return no("inclusion fee above the sponsor cap");

  const maxTime = Number(tx.timeBounds?.maxTime ?? 0);
  if (!maxTime) return no("envelope must expire");
  if (maxTime < nowSeconds) return no("envelope already expired");
  if (maxTime > nowSeconds + policy.maxValiditySeconds) return no("envelope valid for too long");

  if (tx.signatures.length !== 1) return no("expected exactly one signature");
  const sig = (tx.signatures[0] as unknown as { signature: unknown }).signature;
  const raw = sigBytes(sig);
  if (!raw || !Keypair.fromPublicKey(tx.source).verify(tx.hash(), Buffer.from(raw))) {
    return no("signature does not match the source account");
  }

  return { ok: true, tx, source: tx.source, fn, resourceFee, inclusionFee };
}
