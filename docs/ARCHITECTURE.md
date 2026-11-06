# Architecture

StarJar has three parts: one Soroban contract, a Next.js app that renders jars
and builds transactions in the browser, and one server route that pays fees.

```
 Browser                              Next.js server                 Stellar
 ───────                              ──────────────                 ───────
 /j/ada  ──── page render ──────────► read creator, totals,  ──sim──► tip jar contract
                                      recent tips (simulate)
 TipForm
   build tip(from, ada, XLM, 5, "hi")
   prepareTransaction ─────────────────────────────────────────sim──► RPC
   wallet signs (Freighter / LOBSTR / …)
   POST /api/sponsor { xdr } ───────► checkEnvelope (policy)
                                      rate limits, fee budget
                                      simulate ──────────────────sim──► RPC
                                      fee bump, sponsor signs
                                      sendTransaction ───────────────► ledger
                                      poll getTransaction ◄──────────  SUCCESS
   ◄──────────────── { hash } ───────
```

## Contract: `contracts/tipjar`

| Function | Purpose |
|---|---|
| `__constructor(admin, tokens)` | Set admin and allowed tokens in the deploy transaction |
| `register(owner, handle, name, bio)` | Claim a handle for an address |
| `update_profile(owner, name, bio)` | Edit display name and bio |
| `tip(from, handle, token, amount, message) → u64` | Transfer `amount` of `token` from `from` to the jar's owner, record it, emit `tipped` |
| `creator`, `handle_of`, `total`, `recent`, `tips_by`, `stats` | Reads |
| `set_token`, `set_paused`, `set_admin`, `upgrade` | Admin |

### Storage

| Key | Kind | Value |
|---|---|---|
| `Admin`, `Paused`, `Stats`, `Token(addr)` | instance | config and global counters |
| `Creator(handle)` | persistent | `Profile { owner, handle, name, bio, joined_ledger }` |
| `HandleOf(owner)` | persistent | reverse lookup |
| `Total(handle, token)` | persistent | lifetime amount received |
| `Recent(handle)` | persistent | last 20 `Tip`s, oldest dropped |
| `TipsBy(addr)` | persistent | tips sent by an address; first tip increments `Stats.tippers` |

Persistent entries are extended to 120 days (mainnet's minimum persistent TTL)
when written, and refreshed only once less than ~113 days remain, so an active
jar pays rent about once a week.

### Events

| Topics | Data |
|---|---|
| `["registered", handle]` | `{ owner }` |
| `["tipped", handle, from]` | `{ id, token, amount, message }` |

`scripts/export-users.ts` reads these to produce the activity CSV.

## Fee sponsorship

Stellar's fee bump (CAP-15) wraps a signed transaction in a second envelope
whose only content is "this account pays the fee". The inner transaction and
its signature are untouched, so the sponsor cannot change what the user signed.
For Soroban the fee bump must cover the inner transaction's resource fee; the
SDK's `buildFeeBumpTransaction` adds it on top of the inclusion fee.

The route at `src/app/api/sponsor/route.ts` does, in order:

1. `checkEnvelope` (pure, in `src/lib/server/sponsor-policy.ts`): one
   `invokeContract` op on the StarJar contract, function `tip` or `register`,
   acting address = source = signer, source-account auth only, fees under the
   caps, expiry within 5 minutes, minimum tip amount, valid signature.
2. Rate limits: whole service, per IP, per account.
3. `simulateTransaction` on the signed envelope. A failing call is refused
   before the sponsor signs anything, because failed transactions still pay.
4. Reserve the fee bump's maximum fee against the daily budget.
5. Build and sign the fee bump; `sendTransaction`; poll `getTransaction` for up
   to 30 seconds.

Why source-account auth only: when the acting address is the transaction's
source, Soroban treats the envelope signature as the authorisation for every
`require_auth` in the call tree, including the token transfer. One wallet
prompt, no separate auth-entry signing, and the sponsor can verify everything
by checking a single signature.

## App

| Path | Rendering | What it does |
|---|---|---|
| `/` | static, revalidated every 30s | Landing page with live `stats()` |
| `/app` | client | Connect wallet, claim a handle, dashboard with share link and latest tips |
| `/j/[handle]` | server, per request | Profile, totals, recent tips; `TipForm` |
| `/api/sponsor` | node route | Fee bump |
| `/api/health` | node route | Contract readable, sponsor balance |
| `/opengraph-image` | generated | Share card |

Reads go through `simulateTransaction` with a throwaway source account: free,
no account needed, and the same code works on the server and in the browser.
Wallets connect through Stellar Wallets Kit, so Freighter, LOBSTR, xBull,
Albedo, Hana and Rabet share one code path.

## Configuration

| Variable | Where | Meaning |
|---|---|---|
| `PUBLIC_STELLAR_NETWORK` | build | `testnet` or `mainnet` |
| `PUBLIC_TIPJAR_CONTRACT_ID` | build | Contract address |
| `PUBLIC_XLM_SAC`, `PUBLIC_USDC_SAC` | build | Stellar Asset Contract addresses |
| `PUBLIC_RPC_URL` | build | Optional RPC override |
| `PUBLIC_SITE_URL` | build | Used in share links and metadata |
| `SPONSOR_SECRET` | server only | Fee-paying account |
| `SPONSOR_MAX_RESOURCE_FEE` | server | Per-transaction cap, stroops |
| `SPONSOR_MIN_TIP_RAW` | server | Smallest sponsored tip, raw units |
| `SPONSOR_DAILY_LIMIT_PER_ACCOUNT` | server | Sponsored transactions per account per day |
| `SPONSOR_DAILY_BUDGET_XLM` | server | Fee budget per UTC day |
