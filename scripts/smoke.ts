/**
 * The whole gasless flow against testnet, through the real sponsor route.
 *
 * Two fresh accounts are funded by friendbot. The creator registers a jar and
 * the fan tips it, each signing only their own envelope; the sponsor pays both
 * fees. Then the balances show who paid what.
 *
 *   npm run smoke
 */
import "dotenv/config";
import { config as load } from "dotenv";
load({ path: ".env.local" });

const { Account, Horizon, Keypair, TransactionBuilder } = await import("@stellar/stellar-sdk");
const { CONFIG, TOKENS } = await import("../src/lib/config.ts");
const { server, ops, getCreator, getRecent, getStats, getTotal } = await import("../src/lib/soroban.ts");
const { POST } = await import("../src/app/api/sponsor/route.ts");

if (CONFIG.network !== "testnet") throw new Error("smoke runs on testnet only");
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const xlm = TOKENS.find((t) => t.symbol === "XLM")!;

const step = (n: number, s: string) => console.log(`\n${n}. ${s}`);
const balance = async (g: string) =>
  (await horizon.loadAccount(g)).balances.find((b) => b.asset_type === "native")!.balance;

async function fund(kp: InstanceType<typeof Keypair>) {
  const r = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`);
  if (!r.ok) throw new Error(`friendbot: ${r.status}`);
}

/** What the browser does: build, prepare, sign with the user's key, post. */
async function sponsored(kp: InstanceType<typeof Keypair>, op: ReturnType<typeof ops.tip>) {
  const rpcServer = server();
  const acct = await rpcServer.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), {
    fee: "100",
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(kp);
  console.log("   resource fee", (prepared.toEnvelope() as any).value.tx.ext.value.resourceFee.toString());
  const res = await POST(
    new Request("http://local/api/sponsor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ xdr: prepared.toXDR() }),
    }),
  );
  const body = await res.json();
  if (!body.ok) throw new Error(`${res.status} ${body.error}`);
  return body as { hash: string; result: unknown; feeCharged: string };
}

const creator = Keypair.random();
const fan = Keypair.random();
const handle = `smoke_${Math.random().toString(36).slice(2, 8)}`;

step(1, "Fund a creator and a fan from friendbot");
await Promise.all([fund(creator), fund(fan)]);
const before = { creator: await balance(creator.publicKey()), fan: await balance(fan.publicKey()) };
console.log("   creator", before.creator, "XLM  fan", before.fan, "XLM");

step(2, `Creator registers @${handle}, sponsor pays the fee`);
const reg = await sponsored(creator, ops.register(creator.publicKey(), handle, "Smoke Test", "made by npm run smoke"));
console.log("   tx", reg.hash);
console.log("   jar", await getCreator(handle));

step(3, "Fan tips 5 XLM with a message, sponsor pays the fee");
const tip = await sponsored(fan, ops.tip(fan.publicKey(), handle, xlm.contract, 5_0000000n, "first tip from the smoke test"));
console.log("   tx", tip.hash, "tip id", tip.result);

step(4, "Balances: the fan paid exactly the tip, the creator paid nothing");
const after = { creator: await balance(creator.publicKey()), fan: await balance(fan.publicKey()) };
const dFan = Number(after.fan) - Number(before.fan);
const dCreator = Number(after.creator) - Number(before.creator);
console.log(`   fan      ${before.fan} → ${after.fan}  (${dFan.toFixed(7)})`);
console.log(`   creator  ${before.creator} → ${after.creator}  (+${dCreator.toFixed(7)})`);
if (dFan !== -5 || dCreator !== 5) throw new Error("someone other than the sponsor paid a fee");

step(5, "Read it back from the contract");
console.log("   total", (await getTotal(handle, xlm.contract)).toString(), "stroops");
console.log("   recent", (await getRecent(handle)).map((t) => `#${t.id} ${t.message}`));
console.log("   stats", await getStats());

step(6, "The fan opens a jar too, then asks the sponsor to pay for a tip signed as the creator");
const fanHandle = `${handle}_f`;
await sponsored(fan, ops.register(fan.publicKey(), fanHandle, "Smoke Fan", ""));
const bad = await sponsored(fan, ops.tip(creator.publicKey(), fanHandle, xlm.contract, 1n, "x")).catch((e) => e.message);
console.log("  ", bad);
if (!/caller must be the transaction source/.test(String(bad))) throw new Error("expected the sponsor to refuse");

console.log(`\nok. ${CONFIG.explorer}/contract/${CONFIG.contractId}`);
