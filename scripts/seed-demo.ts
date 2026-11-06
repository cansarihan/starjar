/**
 * A demo jar on testnet with a few tips, for screenshots and walkthroughs.
 * Every account is fresh from friendbot and every call goes through the real
 * sponsor route, so the jar looks exactly like one a user would create.
 *
 *   npm run seed:demo
 */
import { config as load } from "dotenv";
load({ path: ".env.local" });

const { Keypair, TransactionBuilder } = await import("@stellar/stellar-sdk");
const { CONFIG, TOKENS } = await import("../src/lib/config.ts");
const { server, ops } = await import("../src/lib/soroban.ts");
const { POST } = await import("../src/app/api/sponsor/route.ts");

if (CONFIG.network !== "testnet") throw new Error("seed:demo runs on testnet only");
const xlm = TOKENS.find((t) => t.symbol === "XLM")!;
type Kp = InstanceType<typeof Keypair>;

async function fund(kp: Kp) {
  const r = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`);
  if (!r.ok) throw new Error(`friendbot ${r.status}`);
}

async function sponsored(kp: Kp, op: ReturnType<typeof ops.tip>) {
  const rpcServer = server();
  const tx = new TransactionBuilder(await rpcServer.getAccount(kp.publicKey()), {
    fee: "100",
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(kp);
  const res = await POST(
    new Request("http://local/api/sponsor", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": `seed-${kp.publicKey()}` },
      body: JSON.stringify({ xdr: prepared.toXDR() }),
    }),
  );
  const body = await res.json();
  if (!body.ok) throw new Error(body.error);
  return body.hash as string;
}

const handle = process.argv[2] ?? "mira_draws";
const creator = Keypair.random();
await fund(creator);
await sponsored(
  creator,
  ops.register(creator.publicKey(), handle, "Mira Kaya", "Illustrator. I draw a small city every week and post the process."),
);
console.log(`jar   /j/${handle}   owner ${creator.publicKey()}`);

const tips: [number, string][] = [
  [5, "The lighthouse one is my phone wallpaper now"],
  [2, "for coffee ☕"],
  [10, "Your process videos taught me perspective. Thank you!"],
  [1, ""],
  [3, "more night scenes please ✦"],
];
for (const [amount, message] of tips) {
  const fan = Keypair.random();
  await fund(fan);
  const hash = await sponsored(fan, ops.tip(fan.publicKey(), handle, xlm.contract, BigInt(amount * 1e7), message));
  console.log(`tip   ${amount} XLM   ${hash}`);
}
