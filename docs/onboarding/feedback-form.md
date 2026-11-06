# User onboarding form

Create this in Google Forms (forms.new). Title and questions below are ready to
paste. After it collects responses: **Responses → Link to Sheets**, then
**File → Download → Microsoft Excel (.xlsx)**, save it as
`docs/onboarding/starjar-user-feedback.xlsx`, and commit it. The README links
to that file.

---

**Title:** StarJar · early user feedback

**Description:**
Thanks for trying StarJar, gasless tip jars on Stellar. This takes two minutes.
We use your wallet address only to confirm your on-chain activity; it is
already public on the Stellar ledger.

| # | Question | Type | Required |
|---|---|---|---|
| 1 | Name | Short answer | Yes |
| 2 | Email | Short answer, *Response validation → Text → Email* | Yes |
| 3 | Stellar wallet address (starts with G) | Short answer, *Regex → Matches* `^G[A-Z2-7]{55}$` | Yes |
| 4 | What did you do on StarJar? | Checkboxes: *Opened a jar* · *Sent a tip* · *Received a tip* | Yes |
| 5 | Which wallet did you use? | Multiple choice: Freighter · LOBSTR · xBull · Albedo · Hana · Rabet · Other | Yes |
| 6 | How would you rate StarJar overall? | Linear scale 1–5 (1 = poor, 5 = excellent) | Yes |
| 7 | How easy was it to send or receive your first tip? | Linear scale 1–5 (1 = very hard, 5 = very easy) | Yes |
| 8 | Did anything go wrong or confuse you? | Paragraph | No |
| 9 | What one feature would make you use StarJar more? | Paragraph | No |
| 10 | Would you recommend StarJar to a creator you know? | Multiple choice: Yes · Maybe · No | Yes |

Settings: collect email addresses **off** (question 2 covers it), limit to one
response **off** (people without Google accounts should be able to answer).

## Turning answers into the README

1. Cross-check question 3 against `docs/proof/mainnet-events.csv`; count only
   addresses that appear there as verified users.
2. Group question 8 and 9 answers into themes.
3. For each theme you act on, make the change, then add a row to the README's
   **Feedback and next phase** table with the commit link
   (`https://github.com/cansarihan/starjar/commit/<sha>`).
