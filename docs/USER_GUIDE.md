# User guide

StarJar lets you send or receive tips on Stellar without paying network fees.
This guide covers both sides.

## What you need

- A Stellar wallet. [Freighter](https://www.freighter.app) (browser extension)
  and [LOBSTR](https://lobstr.co) (mobile and web) are the easiest. xBull,
  Albedo, Hana and Rabet also work.
- An **active** Stellar account: one that holds at least the network's minimum
  balance (1 XLM for a new account). Any exchange that supports XLM withdrawals
  can fund it.
- To tip in USDC: USDC in your wallet. To receive USDC: a USDC trustline.

You never need extra XLM for fees. StarJar pays them.

## For creators: open a jar

1. Go to **starjar → Open your jar**.
2. Click **Connect wallet** and choose your wallet. This is the wallet tips will
   land in.
3. Pick a **handle**: 3 to 24 characters, lowercase letters, digits and `_`.
   It is permanent and becomes your link: `…/j/your_handle`.
4. Add a display name and, optionally, a one-line bio.
5. Click **Open jar · no fee** and approve in your wallet. The wallet shows a
   fee line; you are not charged it.
6. Your dashboard shows your link. **Copy link** or **Share on X**, and put it
   in your bio, video description or stream overlay.

### Accepting USDC

Your jar takes XLM from the start. To also take USDC, add a USDC trustline in
your wallet (in Freighter: *Manage assets → Add asset → USDC by centre.io*; in
LOBSTR: search *USDC* and add it). The USDC option appears on your jar page
automatically.

### Where the money goes

Directly to your wallet, in the same transaction as the tip. StarJar never
holds it. There is nothing to withdraw; check your wallet balance.

## For fans: send a tip

1. Open the creator's link.
2. Pick **XLM** or **USDC** and an amount. The smallest gasless tip is 0.1.
3. Optionally write a message (up to 140 characters). **Messages are public and
   permanent** on the Stellar ledger.
4. Click **Connect wallet and tip**, choose your wallet, and approve.
5. After about five seconds you see a confirmation and a link to the
   transaction on stellar.expert.

Your wallet only loses the amount you tipped.

## Limits

| | |
|---|---|
| Smallest gasless tip | 0.1 XLM or 0.1 USDC |
| Sponsored transactions per wallet | 10 per day |
| Message length | 140 characters (fewer for emoji and non-Latin scripts, which take more bytes) |
| Jars per wallet | 1 |

## Troubleshooting

| Message | What to do |
|---|---|
| *This wallet is not active on Stellar yet* | Send at least 2 XLM to the wallet from an exchange or another wallet |
| *Not enough balance for this tip* | Lower the amount; remember 1 XLM stays locked as the account minimum |
| *One of the wallets has no trustline for that token* | For USDC: you need USDC in your wallet, and the creator needs a USDC trustline |
| *That handle is taken* | Pick another; handles are first come, first served |
| *This wallet already has a jar* | One jar per wallet. Open the dashboard to see it |
| *Daily limit of sponsored transactions reached* | Wait until tomorrow (UTC), or tip from another wallet |
| *Today's fee budget is used up* | StarJar's daily fee budget ran out. It resets at 00:00 UTC |
| Wallet popup does not appear | Unlock the wallet extension, allow pop-ups for the site, and check it is on the right network (Mainnet) |

## Privacy

Everything a jar shows is public on Stellar: the creator's wallet address, every
tipper's address, amounts and messages. StarJar's website stores only your
connected wallet address in your own browser.

## Feedback

Tell us what to build next through the feedback form linked in the README.
