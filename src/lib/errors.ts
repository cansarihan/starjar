/** The contract's error codes, as the person using the app would describe them. */
const CODES: Record<number, string> = {
  1: "StarJar is paused for maintenance.",
  2: "Handles use 3 to 24 lowercase letters, digits or underscores.",
  3: "That handle is taken.",
  4: "This wallet already has a jar.",
  5: "This wallet has no jar yet.",
  6: "There is no jar with that handle.",
  7: "That token is not accepted.",
  8: "The amount must be above zero.",
  9: "The message is longer than 140 characters.",
  10: "The name must be 1 to 48 characters.",
  11: "The bio is longer than 160 characters.",
  12: "You cannot tip your own jar.",
};

/** Turn a simulation or host error into one sentence. */
export function explainContractError(raw: string): string {
  const code = /Error\(Contract, #(\d+)\)/.exec(raw)?.[1];
  if (code && CODES[Number(code)]) return CODES[Number(code)];
  if (/trustline/i.test(raw)) return "One of the wallets has no trustline for that token.";
  if (/balance|underfunded|insufficient/i.test(raw)) return "Not enough balance for this tip.";
  return "The network could not simulate this call. Try again in a moment.";
}
