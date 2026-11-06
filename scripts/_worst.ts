import { config as load } from "dotenv"; load({ path: ".env.local" });
const { Keypair, TransactionBuilder } = await import("@stellar/stellar-sdk");
const { CONFIG, TOKENS } = await import("../src/lib/config.ts");
const { server, ops } = await import("../src/lib/soroban.ts");
const creator = Keypair.random(), fan = Keypair.random();
for (const k of [creator, fan]) await fetch(`https://friendbot.stellar.org/?addr=${k.publicKey()}`);
const r = server(); const xlm = TOKENS[0].contract; const h = "worst_" + Math.random().toString(36).slice(2, 7);
async function send(kp: any, op: any) {
  const tx = new TransactionBuilder(await r.getAccount(kp.publicKey()), { fee: "100", networkPassphrase: CONFIG.passphrase }).addOperation(op).setTimeout(60).build();
  const p = await r.prepareTransaction(tx); p.sign(kp);
  const fee = (p.toEnvelope() as any).value.tx.ext.value.resourceFee;
  const s = await r.sendTransaction(p);
  for (;;) { await new Promise(x => setTimeout(x, 1500)); const g = await r.getTransaction(s.hash); if (g.status !== "NOT_FOUND") break; }
  return fee;
}
console.log("register", await send(creator, ops.register(creator.publicKey(), h, "N".repeat(48), "B".repeat(160))));
const msg = "m".repeat(140);
for (let i = 1; i <= 22; i++) { const f = await send(fan, ops.tip(fan.publicKey(), h, xlm, 1_000_000n, msg)); if ([1,2,10,20,21,22].includes(i)) console.log("tip", i, f); }
