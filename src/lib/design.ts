/** Tokens, so a colour is named once. */
export const C = {
  ink: "#0A0A0A",
  black: "#050505",
  panel: "#141416",
  line: "rgba(255,255,255,.08)",
  white: "#FFFFFF",
  paper: "#F2F2F0",
  /** The one accent. Warm, so a tip reads as a gift rather than a payment. */
  sun: "#FFC94A",
  sunDeep: "#C98A00",
  blue: "#5B8CFF",
  coral: "#FF6B5E",
  green: "#3DD68C",
  grey: "#8A8A8A",
} as const;

export const FONT = {
  sans: "'Urbanist', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
} as const;

const fmt = (n: number, digits: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(n);

/** Contract amounts (7 decimals) in, readable number out. */
export const units = (raw: bigint | string | number, decimals = 7, digits = 2) =>
  fmt(Number(raw) / 10 ** decimals, digits);

export const toRaw = (amount: string, decimals = 7): bigint => {
  const [whole, frac = ""] = amount.trim().split(".");
  if (!/^\d+$/.test(whole || "0") || !/^\d*$/.test(frac)) throw new Error("Not a number");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
};

export const shortKey = (key: string, head = 4, tail = 4) =>
  key.length > head + tail ? `${key.slice(0, head)}…${key.slice(-tail)}` : key;
