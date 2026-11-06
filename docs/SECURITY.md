# Security review

This is StarJar's internal security review: what was checked, what was found,
what was changed because of it, and what is still open. It is written for the
mentors who approve Level 6 and for anyone deciding whether to trust a jar.

It is not a third-party audit. If a reviewer finds something this document
missed, open an issue or email the maintainer; see [Reporting](#reporting).

| | |
|---|---|
| Scope | `contracts/tipjar` (Soroban), `src/app/api/sponsor` and `src/lib/server` (fee sponsor), the browser signing flow |
| Contract tests | 19, `cargo test` |
| Sponsor tests | 17, `npm run test:sponsor`, written from the attacker's side |
| End-to-end | `npm run smoke`, two fresh accounts on testnet through the real route |
| Review date | November 2026 |

---

## What there is to protect

1. **Tippers' funds.** Only the tipper may move their tokens, only to the jar
   they chose, only for the amount they signed.
2. **Creators' identity.** A handle belongs to one address and cannot be taken
   over or redirected.
3. **The sponsor's XLM.** The sponsor key pays fees. Anyone who can make it pay
   for arbitrary or failing transactions can drain it.
4. **Availability.** Jars should keep working without the StarJar website.

The contract holds no funds. A tip is a single `transfer` from the tipper to
the creator inside `tip`, so there is no balance in the contract to steal and
no withdraw path to attack.

## Contract

### Authorisation

| Function | Who must sign | Checked by |
|---|---|---|
| `register` | `owner` | `register_requires_owner_auth` |
| `update_profile` | `owner` | `update_profile_keeps_handle` |
| `tip` | `from` (also authorises the inner token transfer) | `tip_requires_tipper_auth_for_the_transfer`, `tip_without_auth_is_rejected` |
| `set_token`, `set_paused`, `upgrade` | admin | `admin_calls_require_admin_auth`, `admin_calls_fail_without_auth` |
| `set_admin` | current admin **and** new admin | `set_admin_needs_both_signatures` |

Initialisation happens in `__constructor`, inside the deploy transaction, so
there is no window in which someone else can initialise the contract first.

### Checklist

| Check | Result |
|---|---|
| Missing `require_auth` on a state-changing function | None. Every write authenticates the acting address |
| Acting on behalf of another address | `tip` moves funds only `from` the address that signed; `transfer` is a sub-invocation of that same signature |
| Arbitrary token contracts | Refused. Tokens are allowlisted by the admin (`TokenNotAllowed`); a malicious token cannot be used to re-enter or fake transfers |
| Re-entrancy | State is written before the transfer, and the only external call is to an allowlisted Stellar Asset Contract, which does not call back |
| Integer overflow | `overflow-checks = true` in release; totals use `checked_add`; amounts must be `> 0` |
| Handle squatting by look-alikes | Handles are `[a-z0-9_]{3,24}`. Mixed case and Unicode look-alikes are rejected on chain (`handle_rules`) |
| Handle takeover | One handle per address and one address per handle; handles cannot be changed or transferred |
| Self-tipping to inflate stats | Refused (`SelfTip`) |
| Unbounded storage growth | Recent tips are capped at 20 per jar; messages at 140 bytes, names at 48, bios at 160 |
| Failed transfer leaving partial state | Soroban reverts the whole invocation; `tip_larger_than_balance_reverts_everything` confirms nothing is booked |
| Entry archival breaking jars | Entries live 120 days and are refreshed on every write and tip (`writes_keep_entries_alive_for_months`). See open items |
| Pausing | Stops `register` and `tip` only; reads and profile edits keep working (`pause_blocks_writes_but_not_reads`) |

### Admin powers

The admin can add or remove tokens, pause new tips and registrations, rotate
itself, and upgrade the contract's code. It cannot move anyone's funds, because
the contract never holds any. The admin cannot edit or take a creator's handle.

Upgrade is the strongest power: new code could change what `tip` does for
future calls. Mitigations, in order of strength:

1. The admin is a Stellar account, so it can be made multisig (see
   [Hardening the admin](#hardening-the-admin)).
2. Contract releases are built by the public `release.yml` workflow; the WASM
   hash on chain can be compared with the hash in the GitHub release.
3. Each upgrade is a public transaction on the contract's history.

## Fee sponsor

The sponsor is the part with the most attack surface: it signs with a key that
holds XLM, in response to anonymous HTTP requests.

### What the sponsor refuses

Every rule below has a test in `scripts/sponsor-policy.test.ts`.

| An attacker sends… | Refused because |
|---|---|
| A payment, or any non-contract operation | Only `invokeHostFunction` → `invokeContract` |
| A call to another contract | Contract ID must be StarJar's |
| `set_admin`, `upgrade`, `set_paused`, `set_token` | Only `tip` and `register` are sponsored |
| A tip or registration acting as someone else | First argument must equal the envelope's source account |
| An envelope carrying address-credential auth entries | Only source-account authorisation; one signature covers everything |
| Two operations, or two signatures | Exactly one of each |
| A signature from the wrong key, or for another network | Signature is verified against the source account and the network passphrase |
| An expensive envelope | Resource fee capped at 0.2 XLM and inclusion fee at 10,000 stroops |
| An envelope valid for hours, or already expired | Must expire within 5 minutes |
| An already fee-bumped envelope | Refused |
| A muxed (M…) source to dodge per-account limits | Plain G accounts only |
| Dust tips to burn the sponsor's balance | Minimum sponsored tip 0.1 XLM / 0.1 USDC |
| A call that would fail on chain | The route simulates first; a failing call is refused before the sponsor signs |

### Spending limits

| Limit | Default | Env |
|---|---|---|
| Per source account | 10 sponsored transactions / day | `SPONSOR_DAILY_LIMIT_PER_ACCOUNT` |
| Per client IP | 30 / hour | — |
| Whole service | 200 / hour | — |
| Daily fee budget | 25 XLM / UTC day, charged at the maximum possible fee | `SPONSOR_DAILY_BUDGET_XLM` |
| Per transaction | 0.2 XLM resource fee | `SPONSOR_MAX_RESOURCE_FEE` |

Measured on testnet with the 120-day TTL: registering costs about 0.124 XLM in
resource fees; a wallet's first tip to a jar about 0.154 XLM, because it creates
that wallet's counters; later tips about 0.073 XLM while the jar's recent-tips
list is still growing (the list pays rent on its new bytes), and about
0.0025 XLM once it holds twenty 140-byte messages and stops growing. All are
under the 0.2 XLM cap. The network refunds the unused part of the resource fee, so
the actual charge is lower than the reserved maximum.

The client IP is taken from `x-real-ip`, or the **last** entry of
`x-forwarded-for`, which is the one the hosting proxy added. Earlier entries
are client-controlled and ignored.

### Sponsor key handling

- `SPONSOR_SECRET` is read only in route handlers and is not listed in
  `next.config.mjs`'s `env`, so it never reaches the client bundle. Built
  output can be checked with `grep -r "S[A-Z2-7]\{55\}" .next/static` (no match).
- The sponsor account should hold only a few days of fees. `/api/health`
  returns 503 when it drops below 20 XLM, for an uptime monitor to alert on.
- The sponsor is a separate account from the contract admin. Losing the sponsor
  key loses at most its balance; it has no power over the contract.

## Browser

| Check | Result |
|---|---|
| XSS through names, bios or messages | All rendered as React text nodes; nothing uses `dangerouslySetInnerHTML`. Bios are not auto-linked |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| What the wallet signs | The prepared contract call, shown by the wallet before approval. The app never sees a secret key |
| Stored data | Only the connected public key, in `localStorage` |
| Handle in the URL | Validated against the same pattern as the contract before any RPC call; anything else is a 404 |

## Findings and fixes

Issues found during this review and fixed before mainnet:

| # | Finding | Severity | Fix | Commit |
|---|---|---|---|---|
| 1 | Dust tips (1 stroop) let anyone spend the sponsor's XLM on fees at ~0.07 XLM each | High | Minimum sponsored tip, daily fee budget, lower global rate | "Bound the sponsor: minimum tip, daily fee budget, proxy-set client IP" |
| 2 | Per-IP limit keyed on the first `x-forwarded-for` entry, which the client sets | Medium | Use `x-real-ip` or the proxy-added last entry | same |
| 3 | Persistent entries lived 30 days; an inactive jar would be archived, its page would 404 and the sponsor would not pay for the restore | Medium | 120-day TTL refreshed on writes and tips; the owner lookup is refreshed on each tip | "Keep jars alive for months…", "Match entry lifetime to mainnet's minimum TTL…" |
| 4 | The first transaction after deploy carried the code and instance rent (3.36 XLM on testnet), above the sponsor cap | Low | Deploy script prepays rent for code and instance | "Prepay contract rent at deploy…" |
| 5 | Sponsor would pay for calls that then failed on chain | Low | Simulate before signing the fee bump | "Fee-bump route: simulate, wrap…" |

## Open items

These are known and accepted for launch; each is listed in the README's
limitations as well.

1. **Rate limits are per server instance.** Counters live in process memory.
   On a host that runs many instances the limits multiply. The daily fee budget
   is the backstop: even multiplied, it bounds the loss per instance. Moving the
   counters to Redis is planned.
2. **Single-key admin at launch** unless the admin account is converted to
   multisig, as described below.
3. **Archived jars.** A jar untouched for 120 days is archived by the network.
   It can be restored with a `RestoreFootprint` operation, paid by whoever
   restores it; the sponsor does not pay for restores.
4. **Messages are public and permanent.** The UI says so next to the field.
   There is no moderation on chain; the website could hide messages, but the
   ledger keeps them.
5. **Simulation race.** A tipper's balance can change between the sponsor's
   simulation and the ledger applying the transaction. The sponsor then pays
   for one failed transaction. This is bounded by the per-account limit.

## Hardening the admin

To turn the admin into a 2-of-3 multisig account without redeploying, add
signers and raise the thresholds on the admin account itself:

```bash
stellar tx new set-options --source starjar-admin --network mainnet \
  --signer <SECOND_G_ADDRESS> --signer-weight 1
stellar tx new set-options --source starjar-admin --network mainnet \
  --signer <THIRD_G_ADDRESS> --signer-weight 1
stellar tx new set-options --source starjar-admin --network mainnet \
  --master-weight 1 --low-threshold 2 --med-threshold 2 --high-threshold 2
```

After this, every `require_auth` for the admin (upgrade, pause, token list)
needs two of the three keys.

## Reporting

Please report vulnerabilities privately to cansarihan@bluenetwork.com.tr or via
GitHub's private vulnerability reporting on the repository. Expect a reply
within three days.
