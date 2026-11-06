<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/readme-dark.svg">
  <img src="public/brand/readme-light.svg" alt="starjar" width="260">
</picture>

[![CI](https://github.com/cansarihan/starjar/actions/workflows/ci.yml/badge.svg)](https://github.com/cansarihan/starjar/actions/workflows/ci.yml)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-c98a00?style=flat-square)](https://stellar.org)
[![Fee sponsorship](https://img.shields.io/badge/advanced%20feature-fee%20bump%20sponsorship-4a4a4a?style=flat-square)](#fee-sponsorship)

<br>

**Tip any creator. Pay zero gas.** A creator opens a jar and gets a link. A fan
opens it, picks an amount in XLM or USDC, writes a line of thanks and signs
once. The money moves from the fan's wallet to the creator's in the same
contract call, in about five seconds, and StarJar pays the network fee with a
Stellar fee bump. The fan needs no XLM for gas, the creator needs nothing at
all, and StarJar never holds a single stroop of anyone's money.

Rise In × Stellar Builder Challenge · Level 6 Black Belt · built by
[cansarihan](https://github.com/cansarihan)

**Live:** _pending mainnet launch_ · **Contract (testnet):**
[`CBPKETG2…TDLRE`](https://stellar.expert/explorer/testnet/contract/CBPKETG2BKW2AGA5ALX4L3YERCFJBTFPMAJ62BGBJMX5AWBMIP6TDLRE)

---

## Evaluating this in five minutes

```bash
npm install
cp .env.example .env.local        # fill in the testnet values below
npm run build && npm start        # http://localhost:3000
npm run test:contracts            # 19 contract tests
npm run test:sponsor              # 17 sponsor-policy tests, from the attacker's side
npm run smoke                     # the whole gasless flow against testnet
```

`npm run smoke` is the one to run. It funds two fresh testnet accounts, has one
open a jar and the other tip it, both through the real sponsor route, then
checks that the fan's balance moved by exactly the tip and the creator's by
exactly the tip received. If either of them paid a fee, it fails. Last, it has
the fan ask the sponsor to pay for a tip signed as someone else, which the
sponsor refuses.

What to look for, in order:

| | Where | What it shows |
|---|---|---|
| 1 | `npm run smoke`, step 4 | Balances change by the tip only. The fee came from the sponsor |
| 2 | Any tip transaction on stellar.expert | A fee-bump envelope: fee source is the sponsor, the inner transaction is signed by the fan |
| 3 | `npm run test:sponsor` | Fifteen ways to get free fees out of the sponsor, each refused with its reason |
| 4 | [`docs/SECURITY.md`](docs/SECURITY.md) | The review, what it found and what changed because of it |

Known limitations are in [Honest limitations](#honest-limitations), not buried.

---

## The problem

Creators already get tipped on Stellar the hard way: they paste a G-address into
a bio, a fan copies it into a wallet, picks an asset, hopes they got the memo
right, and pays a fee in XLM they may not have. Nobody sees who tipped or why.
On most chains it is worse: the fan needs the native token for gas before they
can send anything at all, and that first purchase is where most people stop.

## What StarJar does

| | |
|---|---|
| **A jar is a link** | `…/j/ada`. One handle per wallet, lowercase, permanent, enforced by the contract |
| **Tips carry messages** | Up to 140 bytes, stored on chain with the payment. The last 20 show on the jar |
| **XLM and USDC** | Through their Stellar Asset Contracts. USDC appears when the creator has a trustline |
| **No gas for users** | The sponsor wraps each signed call in a fee bump and pays for it |
| **No custody** | `tip` is one `transfer` from fan to creator. The contract never holds funds |
| **Any wallet** | Freighter, LOBSTR, xBull, Albedo, Hana and Rabet through Stellar Wallets Kit |
| **Public numbers** | Jars, tips and unique tippers are counters in the contract, shown live on the home page |

## Architecture

```
Browser ── build + prepare + wallet signs ──► /api/sponsor ── policy · limits · simulate
                                                           └─ fee bump (sponsor signs) ──► Stellar
Pages ── read through simulation ─────────────────────────────────────────────────────► tip jar contract
```

| Part | Where |
|---|---|
| Soroban contract | [`contracts/tipjar`](contracts/tipjar/src/lib.rs) |
| Sponsor policy (pure, tested) | [`src/lib/server/sponsor-policy.ts`](src/lib/server/sponsor-policy.ts) |
| Sponsor route | [`src/app/api/sponsor/route.ts`](src/app/api/sponsor/route.ts) |
| Browser flow | [`src/lib/gasless.ts`](src/lib/gasless.ts), [`src/components/TipForm.tsx`](src/components/TipForm.tsx) |
| Activity export | [`scripts/export-users.ts`](scripts/export-users.ts) |

Full detail, including storage layout and events: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Fee sponsorship

The Level 6 advanced feature. Stellar's fee bump (CAP-15) lets one account pay
the fee for another's transaction without being able to change it: the inner
transaction keeps its own signature, which covers the amount, the recipient and
the message. StarJar's sponsor only signs a fee bump after the envelope passes a
policy:

- one `invokeContract` operation, on the StarJar contract, calling `tip` or `register`;
- the acting address is the transaction source, and only source-account auth is used;
- the signature verifies; fees are under the caps; it expires within 5 minutes;
- tips are at least 0.1 XLM or 0.1 USDC;
- it passes simulation, because failed transactions still cost their fee.

Then per-account, per-IP and global rate limits, and a daily fee budget charged
at each transaction's maximum possible fee.

## Design decisions and trade-offs

**Direct transfer instead of a balance in the contract.** A jar that
accumulates and is withdrawn later needs withdraw logic, a balance to protect
and an answer for what happens to it if the contract is paused. Transferring in
`tip` removes all three. The cost: the contract cannot offer features that
need pooled funds, such as goals with refunds.

**Source-account auth only.** When the acting address is the transaction's
source, one envelope signature authorises every `require_auth` in the call,
including the token transfer. The user sees one prompt, and the sponsor can
check everything with one signature verification. Smart-wallet (contract)
accounts cannot use the sponsor for now; they can still call the contract and
pay their own fee.

**Allowlisted tokens.** Any-token tipping would let a malicious token contract
run code inside `tip`. Two well-known Stellar Asset Contracts cover the use case.

**Handles are permanent and ASCII.** Links never break, and `ada` cannot be
impersonated by `Ada` or a Cyrillic `аda`. Display names are free text.

**120-day entry lifetime.** It is mainnet's minimum for a new persistent entry,
so creating one costs no rent beyond what the network requires. Entries are
refreshed when written or tipped, at most weekly.

**Reads through simulation.** Every read is a `simulateTransaction` with a
throwaway source. Free, needs no account, same code on server and client, and
no indexer to run.

## Testing

| Suite | Count | Command |
|---|---|---|
| Contract (auth, validation, limits, pause, admin, TTL) | 19 | `npm run test:contracts` |
| Sponsor policy (attacker's side) | 17 | `npm run test:sponsor` |
| End-to-end on testnet | 6 steps | `npm run smoke` |
| Type check and production build | — | `npm run typecheck && npm run build` |

All but `smoke` run in CI on every push.

## Security

[`docs/SECURITY.md`](docs/SECURITY.md) is the internal security review submitted
for mentor approval: threat model, authorisation table, a checklist for the
contract, the sponsor and the browser, five findings fixed before launch with
the commits that fixed them, and the open items. Highlights:

- the contract holds no funds and every write authenticates the acting address;
- the sponsor refuses 15 kinds of abusive envelope, each with a test;
- the sponsor's spending is bounded per transaction, per account, per IP and per day;
- the sponsor key never reaches the client bundle and has no power over the contract.

## Level 6 submission

| Requirement | Status |
|---|---|
| Public repository, 30+ meaningful commits | ✅ this repository |
| Contract on mainnet | ⏳ pending, see [Deployed artifacts](#deployed-artifacts) |
| Live production app | ⏳ pending |
| 20+ verified mainnet users | ⏳ [`docs/proof/`](docs/proof) once live |
| Transaction activity proof | ⏳ [`docs/proof/mainnet-events.csv`](docs/proof) and the contract on stellar.expert |
| Security review | ✅ [`docs/SECURITY.md`](docs/SECURITY.md) |
| Advanced feature | ✅ [Fee sponsorship](#fee-sponsorship) |
| Technical documentation | ✅ [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| User guide | ✅ [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) |
| Community contribution | ✅ [Tutorial: gasless Soroban calls with fee bumps](docs/blog/gasless-soroban-with-fee-bump.md) |
| X launch post | ⏳ pending · draft in [`docs/launch/x-thread.md`](docs/launch/x-thread.md) |
| Demo video | ⏳ pending · script in [`docs/launch/demo-script.md`](docs/launch/demo-script.md) |
| User feedback form and export | ⏳ pending · form in [`docs/onboarding/feedback-form.md`](docs/onboarding/feedback-form.md) |

## Users and feedback

**Onboarding form:** _pending_ · **Responses (Excel):** _pending_, will be
[`docs/onboarding/starjar-user-feedback.xlsx`](docs/onboarding)

**Verified on-chain users:** _pending_, will be
[`docs/proof/mainnet-summary.md`](docs/proof), regenerated daily from contract
events. Every row in the CSV carries its transaction hash.

### Feedback and next phase

Filled in from the form responses. Each row links the commit that acted on it.

| Feedback theme | Responses | What changed | Commit |
|---|---|---|---|
| _pending first responses_ | | | |

Planned for the next phase, before feedback arrives:

1. **Shared rate limits** (Redis), so the sponsor's limits hold across instances.
2. **Jar goals**: a target amount and a progress bar, without pooling funds.
3. **QR codes and embeddable buttons** for stream overlays and websites.
4. **Notifications** for creators when a tip arrives, from contract events.
5. **Smart-wallet support** in the sponsor (address-credential auth with policy
   checks), for passkey wallets.

## Honest limitations

- **Rate limits are per process.** On a multi-instance host the limits multiply.
  The daily fee budget still bounds spending per instance.
- **Single admin key** at launch unless converted to multisig; steps in
  [`docs/SECURITY.md`](docs/SECURITY.md#hardening-the-admin). The admin can
  upgrade the contract; it can never move users' funds.
- **Archived jars.** A jar untouched for 120 days is archived by the network.
  Restoring it is one `RestoreFootprint` operation that the sponsor does not pay for.
- **Messages are public and permanent.** The site could hide one; the ledger keeps it.
- **Activity export depends on RPC retention** (about a week). The daily
  workflow keeps the record complete; a gap of over a week would need
  stellar.expert's history to fill.
- **New users still need an active account.** A Stellar account must hold the
  1 XLM minimum balance to exist. Fee sponsorship removes the gas, not the
  account reserve. Sponsored account creation (CAP-33) is a candidate for the
  next phase.

## Deployed artifacts

| | Network | Address |
|---|---|---|
| Tip jar contract | testnet | [`CBPKETG2BKW2AGA5ALX4L3YERCFJBTFPMAJ62BGBJMX5AWBMIP6TDLRE`](https://stellar.expert/explorer/testnet/contract/CBPKETG2BKW2AGA5ALX4L3YERCFJBTFPMAJ62BGBJMX5AWBMIP6TDLRE) |
| XLM SAC | testnet | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| USDC SAC | testnet | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Tip jar contract | mainnet | _pending_ |
| Fee sponsor | mainnet | _pending_ |

## Running it yourself

```bash
# Prerequisites: Rust with the wasm32v1-none target, stellar-cli 28, Node 20+
stellar keys generate me --network testnet --fund
./scripts/deploy.sh testnet me          # prints the PUBLIC_* values
stellar keys generate sponsor --network testnet --fund
cp .env.example .env.local              # paste the values, SPONSOR_SECRET=$(stellar keys secret sponsor)
npm install && npm run dev
```

Mainnet: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentation

| | |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Contract, storage, events, sponsor path, configuration |
| [Production setup](docs/DEPLOYMENT.md) | Keys, mainnet deploy, hosting, monitoring, operations |
| [Security review](docs/SECURITY.md) | Threat model, checks, findings, open items |
| [User guide](docs/USER_GUIDE.md) | For creators and fans, with troubleshooting |
| [Tutorial](docs/blog/gasless-soroban-with-fee-bump.md) | Gasless Soroban calls with fee bumps |

## License

MIT · Can Sarıhan
