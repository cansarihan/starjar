/**
 * The sponsor's policy, from the side of someone trying to get free fees.
 * Runs offline: every envelope is built and signed here.
 *
 *   npm run test:sponsor
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  Account,
  Address,
  Asset,
  authorizeInvocation,
  Contract,
  Keypair,
  Networks,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";

import { checkEnvelope, type Policy } from "../src/lib/server/sponsor-policy.ts";

const JAR = "CBPKETG2BKW2AGA5ALX4L3YERCFJBTFPMAJ62BGBJMX5AWBMIP6TDLRE";
const OTHER = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const NOW = 1_800_000_000;

const policy: Policy = {
  networkPassphrase: Networks.TESTNET,
  contractId: JAR,
  functions: ["tip", "register"],
  maxResourceFee: 2_000_000n,
  maxInclusionFee: 10_000n,
  minTipAmount: 1_000_000n,
  maxValiditySeconds: 300,
};

interface Opts {
  signer?: Keypair;
  source?: Keypair;
  actor?: string;
  fn?: string;
  contractId?: string;
  resourceFee?: number;
  inclusion?: number;
  maxTime?: number;
  ops?: number;
  extraSig?: Keypair;
  prepared?: boolean;
  passphrase?: string;
  amount?: bigint;
}

function envelope(o: Opts = {}): { xdr: string; source: Keypair; tx: Transaction } {
  const source = o.source ?? Keypair.random();
  const resourceFee = o.resourceFee ?? 120_000;
  const inclusion = o.inclusion ?? 100;
  const fn = o.fn ?? "tip";
  const actor = o.actor ?? source.publicKey();

  const call = new Contract(o.contractId ?? JAR).call(
    fn,
    new Address(actor).toScVal(),
    nativeToScVal("ada", { type: "string" }),
    new Address(OTHER).toScVal(),
    nativeToScVal(o.amount ?? 10_000_000n, { type: "i128" }),
    nativeToScVal("hi", { type: "string" }),
  );

  const builder = new TransactionBuilder(new Account(source.publicKey(), "1"), {
    // build() adds the resource fee on top, the same way prepareTransaction does.
    fee: String(inclusion),
    networkPassphrase: o.passphrase ?? Networks.TESTNET,
    timebounds: { minTime: 0, maxTime: o.maxTime ?? NOW + 120 },
  });
  for (let i = 0; i < (o.ops ?? 1); i++) builder.addOperation(call);
  if (o.prepared !== false) {
    builder.setSorobanData(new SorobanDataBuilder().setResourceFee(resourceFee).build());
  }
  const tx = builder.build();
  tx.sign(o.signer ?? source);
  if (o.extraSig) tx.sign(o.extraSig);
  return { xdr: tx.toXDR(), source, tx };
}

const reason = (x: string) => {
  const v = checkEnvelope(x, policy, NOW);
  return v.ok ? "ok" : v.reason;
};

test("a prepared, self-signed tip is sponsored", () => {
  const { xdr: e, source } = envelope();
  const v = checkEnvelope(e, policy, NOW);
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.source, source.publicKey());
    assert.equal(v.fn, "tip");
    assert.equal(v.resourceFee, 120_000n);
    assert.equal(v.inclusionFee, 100n);
  }
});

test("register is sponsored too", () => {
  assert.equal(reason(envelope({ fn: "register" }).xdr), "ok");
});

test("admin functions are not", () => {
  for (const fn of ["set_paused", "set_admin", "upgrade", "set_token"]) {
    assert.match(reason(envelope({ fn }).xdr), /not sponsored/);
  }
});

test("dust tips are not sponsored", () => {
  assert.equal(reason(envelope({ amount: 999_999n }).xdr), "tip below the sponsored minimum");
  assert.equal(reason(envelope({ amount: 1_000_000n }).xdr), "ok");
});

test("another contract is refused", () => {
  assert.equal(reason(envelope({ contractId: OTHER }).xdr), "not the StarJar contract");
});

test("acting for someone else is refused", () => {
  assert.equal(
    reason(envelope({ actor: Keypair.random().publicKey() }).xdr),
    "caller must be the transaction source",
  );
});

test("a signature from the wrong key is refused", () => {
  assert.equal(
    reason(envelope({ signer: Keypair.random() }).xdr),
    "signature does not match the source account",
  );
});

test("two signatures are refused", () => {
  assert.equal(reason(envelope({ extraSig: Keypair.random() }).xdr), "expected exactly one signature");
});

test("expensive envelopes are refused", () => {
  assert.equal(reason(envelope({ resourceFee: 2_000_001 }).xdr), "resource fee above the sponsor cap");
  assert.equal(reason(envelope({ inclusion: 10_001 }).xdr), "inclusion fee above the sponsor cap");
});

test("envelopes must expire soon, and not already have", () => {
  assert.equal(reason(envelope({ maxTime: NOW + 301 }).xdr), "envelope valid for too long");
  assert.equal(reason(envelope({ maxTime: NOW - 1 }).xdr), "envelope already expired");
});

test("more than one operation is refused", () => {
  assert.equal(reason(envelope({ ops: 2 }).xdr), "exactly one operation allowed");
});

test("an unprepared envelope is refused", () => {
  assert.equal(reason(envelope({ prepared: false }).xdr), "envelope was not prepared (no Soroban resources)");
});

test("a payment is refused", () => {
  const src = Keypair.random();
  const tx = new TransactionBuilder(new Account(src.publicKey(), "1"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
    timebounds: { minTime: 0, maxTime: NOW + 60 },
  })
    .addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: Asset.native(), amount: "1" }))
    .build();
  tx.sign(src);
  assert.equal(reason(tx.toXDR()), "only contract calls are sponsored");
});

test("an envelope for another network does not parse to a valid signature", () => {
  assert.equal(
    reason(envelope({ passphrase: Networks.PUBLIC }).xdr),
    "signature does not match the source account",
  );
});

test("an already fee-bumped envelope is refused", () => {
  const { tx } = envelope();
  const sponsor = Keypair.random();
  const bump = TransactionBuilder.buildFeeBumpTransaction(sponsor, "100", tx, Networks.TESTNET);
  bump.sign(sponsor);
  assert.equal(reason(bump.toXDR()), "already fee-bumped");
});

test("address-credential auth entries are refused", async () => {
  const source = Keypair.random();
  const other = Keypair.random();
  const call = new Contract(JAR).call("tip", new Address(source.publicKey()).toScVal());
  const ic = (call as unknown as { body: { invokeHostFunctionOp: { hostFunction: unknown } } }).body
    ?.invokeHostFunctionOp?.hostFunction as { invokeContract: unknown } | undefined;
  const fnArgs = ic?.invokeContract ?? (call as unknown as { func?: { invokeContract: unknown } }).func?.invokeContract;
  const entry = await authorizeInvocation({
    signer: other,
    validUntilLedgerSeq: 100,
    networkPassphrase: Networks.TESTNET,
    invocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(fnArgs as never),
      subInvocations: [],
    }),
  });
  const parsedOp = TransactionBuilder.fromXDR(
    new TransactionBuilder(new Account(source.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .addOperation(call)
      .setTimeout(60)
      .build()
      .toXDR(),
    Networks.TESTNET,
  ) as Transaction;
  const func = (parsedOp.operations[0] as unknown as { func: xdr.HostFunction }).func;

  const tx = new TransactionBuilder(new Account(source.publicKey(), "1"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
    timebounds: { minTime: 0, maxTime: NOW + 60 },
  })
    .addOperation(Operation.invokeHostFunction({ func, auth: [entry] }))
    .setSorobanData(new SorobanDataBuilder().setResourceFee(120_000).build())
    .build();
  tx.sign(source);
  assert.equal(reason(tx.toXDR()), "only source-account authorisation is sponsored");
});

test("garbage is refused", () => {
  assert.equal(reason("not xdr"), "envelope is not valid XDR");
  assert.equal(reason(""), "envelope missing or too large");
});
