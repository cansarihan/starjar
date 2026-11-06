# Gasless Soroban calls with fee bumps: a working tutorial

*Can Sarıhan · StarJar*

Asking a new user to hold XLM for fees before they can do anything is where a
lot of Stellar onboarding ends. Stellar has a protocol-level answer: the **fee
bump** transaction. Someone else pays the fee for a transaction the user
signed, without being able to change it.

This post shows how StarJar uses fee bumps with Soroban contract calls, with the
code that runs in production, and the three things that cost me time.

## The idea in one paragraph

A fee bump (CAP-15) is an envelope around a signed transaction. It names a fee
source and a fee, and it is signed by that fee source. The inner transaction is
untouched, so its signature still covers its operations: the sponsor can pay
for "Alice sends Bob 5 XLM", but cannot turn it into "Alice sends Mallory
500 XLM". On the ledger the inner transaction's source is still Alice, and her
sequence number is the one consumed.

## Step 1: the user signs a normal, prepared transaction

In the browser, build the contract call with the **user** as the source,
let RPC compute its resources, and have the wallet sign:

```ts
import { Contract, TransactionBuilder, nativeToScVal, Address, rpc } from "@stellar/stellar-sdk";

const server = new rpc.Server("https://mainnet.sorobanrpc.com");
const account = await server.getAccount(userAddress);

const op = new Contract(TIPJAR).call(
  "tip",
  new Address(userAddress).toScVal(),           // from
  nativeToScVal("ada", { type: "string" }),      // handle
  new Address(XLM_SAC).toScVal(),                // token
  nativeToScVal(5_0000000n, { type: "i128" }),   // 5 XLM
  nativeToScVal("thanks!", { type: "string" }),
);

const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase })
  .addOperation(op)
  .setTimeout(180)
  .build();

const prepared = await server.prepareTransaction(tx);
const signedXdr = await wallet.signTransaction(prepared.toXDR(), { address: userAddress, networkPassphrase });
```

Note that `from` is the user and the user is also the transaction source. That
matters in step 3.

## Step 2: the server wraps and submits

```ts
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

const inner = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
const sponsor = Keypair.fromSecret(process.env.SPONSOR_SECRET!);

const bump = TransactionBuilder.buildFeeBumpTransaction(sponsor, "100", inner, networkPassphrase);
bump.sign(sponsor);
const sent = await server.sendTransaction(bump);
```

That is the whole mechanism. The user's balance changes only by what the
contract does; the sponsor's balance pays the fee.

## Gotcha 1: Soroban fees have two parts

A Soroban transaction's fee is an inclusion fee plus a **resource fee**
(CPU, I/O, rent), and `prepareTransaction` puts the resource fee into the
transaction's `sorobanData`. The fee bump has to cover it. In stellar-sdk the
`baseFee` you pass to `buildFeeBumpTransaction` is the *inclusion* fee per
operation; the SDK adds the inner resource fee on top:

```
fee bump fee = baseFee × (operations + 1) + resourceFee
```

And `baseFee` must be at least the inner transaction's own inclusion fee per
operation. I first wrote a test that built an inner transaction with
`fee: inclusion + resourceFee` *and* called `setSorobanData`, and got
"Invalid baseFee, it should be at least 120100 stroops". `build()` already adds
the resource fee to the fee you give it, just as `prepareTransaction` does, so
the fee was counted twice.

## Gotcha 2: a sponsor that signs anything is a faucet

The sponsor endpoint is anonymous and holds XLM. Before wrapping anything,
StarJar checks the envelope against a policy, as a pure function you can test
offline:

- exactly one operation, an `invokeContract` on **our** contract;
- the function is `tip` or `register`, never an admin function;
- the first argument (the acting address) equals the transaction source;
- every auth entry uses **source-account** credentials;
- resource fee and inclusion fee under caps;
- expires within five minutes;
- exactly one signature, and it verifies against the source account;
- for tips, at least 0.1 XLM or 0.1 USDC.

The last rule came out of the security review. Without a minimum, anyone can
send 1-stroop tips all day and every one costs the sponsor around 0.07 XLM.

Then, before signing, **simulate the signed transaction**. A transaction that
fails on chain still pays its fee, and the sponsor is the one paying.

The tests are written from the attacker's side: `scripts/sponsor-policy.test.ts`
builds each envelope an attacker might send and asserts the refusal reason.

## Gotcha 3: why "source account auth only" is worth it

Soroban has two ways to satisfy `require_auth(addr)`. If `addr` is the
transaction source, the envelope signature counts. Otherwise the transaction
carries an auth entry with its own signature.

Requiring the first case gives three things at once. The user sees one wallet
prompt. The sponsor can verify every authorisation in the call by checking a
single ed25519 signature. And there is no way to make the sponsor pay for a
call that acts for an address the signer does not control: the policy test
"address-credential auth entries are refused" covers exactly that.

## Rent is part of the fee

The first time I ran the flow end to end, the first registration needed a
3.36 XLM resource fee. The deploy had left the contract's code and instance
with a short TTL, and the first call paid to extend them. The deploy script now
prepays that rent with `stellar contract extend`, so no user meets it.

Persistent entries are the other half. On mainnet the minimum TTL for a new
persistent entry is 120 days, and rent for it is paid when the entry is
created. StarJar extends entries to exactly that minimum, so creating one costs
nothing beyond what the network already requires, and refreshes them only
when less than about 113 days remain. Measured: a registration is ~0.12 XLM in
resource fees, a wallet's first tip ~0.15 XLM, later tips ~0.07 XLM while the
jar's recent list grows, and ~0.0025 XLM once it is full.

## Try it

- Code: [github.com/cansarihan/starjar](https://github.com/cansarihan/starjar)
- Policy: `src/lib/server/sponsor-policy.ts`
- Route: `src/app/api/sponsor/route.ts`
- End-to-end on testnet: `npm run smoke`

The smoke test funds two fresh accounts, registers one as a creator, tips from
the other, and checks that the fan's balance moved by exactly the tip and the
creator's by exactly the tip received. If either paid a fee, it fails.
