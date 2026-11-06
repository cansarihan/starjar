# Production setup

How StarJar goes from this repository to a live mainnet deployment. Commands
assume stellar-cli 28, Node 20+ and Rust with the `wasm32v1-none` target.

## 1. Keys

Two separate mainnet accounts. Never reuse one for both.

| Account | Role | Funding |
|---|---|---|
| `starjar-admin` | Deploys the contract; contract admin | ~50 XLM (deploy, rent prepayment, reserve) |
| `starjar-sponsor` | Pays users' fees | 50–100 XLM to start; top up from `/api/health` |

```bash
stellar keys generate starjar-admin --network mainnet
stellar keys generate starjar-sponsor --network mainnet
stellar keys address starjar-admin      # fund this from an exchange
stellar keys address starjar-sponsor    # and this
```

Keys are stored under `~/.config/stellar/identity`, outside the repository.
Back them up offline. Consider making the admin multisig right after deploy;
see [SECURITY.md](./SECURITY.md#hardening-the-admin).

## 2. Deploy the contract

```bash
./scripts/deploy.sh mainnet starjar-admin
```

The script builds the WASM, makes sure the USDC Stellar Asset Contract exists,
deploys with the admin and token allowlist set in the constructor, prepays rent
for the code and instance, and prints the values for the next step.

Record the contract ID in the README's **Deployed artifacts** table.

To link the on-chain WASM to this source on stellar.expert, tag a release
(`git tag v1.0.0 && git push --tags`). The `release.yml` workflow builds the
contract in GitHub Actions and publishes the WASM hash. Deploy that exact WASM
(download it from the release) if you want the hashes to match.

## 3. Configure the app

Production environment variables:

```bash
PUBLIC_STELLAR_NETWORK=mainnet
PUBLIC_TIPJAR_CONTRACT_ID=C...          # from deploy.sh
PUBLIC_XLM_SAC=C...                     # from deploy.sh
PUBLIC_USDC_SAC=C...                    # from deploy.sh
PUBLIC_SITE_URL=https://starjar.live    # your domain
# PUBLIC_RPC_URL=                       # optional; a dedicated RPC is better under load

SPONSOR_SECRET=S...                     # stellar keys secret starjar-sponsor
SPONSOR_MAX_RESOURCE_FEE=2000000
SPONSOR_MIN_TIP_RAW=1000000
SPONSOR_DAILY_LIMIT_PER_ACCOUNT=10
SPONSOR_DAILY_BUDGET_XLM=25
```

`PUBLIC_*` values are compiled into the client bundle, so change them only
with a rebuild. `SPONSOR_SECRET` is read at runtime by route handlers only.

## 4. Host

The sponsor's rate limits live in process memory, so the best fit is **one
long-running Node process**: a small VPS, Railway, Render or Fly.io.

```bash
npm ci
npm run build
npm start            # PORT=3000 by default
```

Put it behind a reverse proxy that sets `X-Real-IP` (Caddy and nginx both do
with one line), and terminate TLS there.

**Vercel** works too, with one caveat: each serverless instance keeps its own
counters, so the per-account and per-IP limits apply per instance. The daily
fee budget still caps spending per instance. Set the environment variables in
the project settings; the build needs the `PUBLIC_*` ones.

## 5. Monitor

- Point an uptime monitor (UptimeRobot, Better Stack) at `/api/health`. It
  returns 503 when the contract is unreadable or the sponsor has under 20 XLM.
- Watch the sponsor account on stellar.expert for unusual fee spending.

## 6. Keep the activity record

RPC keeps events for about a week. The `proof.yml` workflow exports them daily
into `docs/proof/mainnet-events.csv` and commits new rows. Enable it by setting
repository **variables** (Settings → Secrets and variables → Actions →
Variables): `PUBLIC_STELLAR_NETWORK=mainnet`, `PUBLIC_TIPJAR_CONTRACT_ID`,
`PUBLIC_XLM_SAC`, `PUBLIC_USDC_SAC`. Run it once by hand from the Actions tab.

Locally: `npm run users:export` with the mainnet values in `.env.local`.

## 7. Operating

```bash
# Pause new tips and registrations (reads keep working)
stellar contract invoke --id starjar-mainnet --source starjar-admin --network mainnet -- set_paused --paused true

# Accept another token
stellar contract invoke --id starjar-mainnet --source starjar-admin --network mainnet -- set_token --token C... --allowed true

# Upgrade the code
stellar contract upload --wasm target/wasm32v1-none/release/starjar_tipjar.wasm --source starjar-admin --network mainnet
stellar contract invoke --id starjar-mainnet --source starjar-admin --network mainnet -- upgrade --wasm_hash <HASH>
```

## 8. Rotating the sponsor key

1. Generate and fund a new sponsor account.
2. Change `SPONSOR_SECRET` and restart.
3. Merge the old account into the new one:
   `stellar tx new account-merge --source-account starjar-sponsor-old --account <NEW_G> --network mainnet`.

The sponsor has no role in the contract, so rotation needs no on-chain change
to StarJar itself.
