import { Networks } from "@stellar/stellar-sdk";

export type NetworkName = "testnet" | "mainnet";

const network: NetworkName = process.env.PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

const HORIZON: Record<NetworkName, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

const RPC_DEFAULT: Record<NetworkName, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

/** Values every page and route agrees on. Read once, from the build env. */
export const CONFIG = {
  network,
  passphrase: network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  rpcUrl: process.env.PUBLIC_RPC_URL || RPC_DEFAULT[network],
  horizonUrl: HORIZON[network],
  contractId: process.env.PUBLIC_TIPJAR_CONTRACT_ID ?? "",
  siteUrl: process.env.PUBLIC_SITE_URL || "http://localhost:3000",
  explorer: `https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}`,
} as const;

export interface TokenInfo {
  symbol: "XLM" | "USDC";
  contract: string;
  /** Classic asset, for trustline checks. `null` for native XLM. */
  classic: { code: string; issuer: string } | null;
  decimals: number;
  /** Quick amounts on the tip form, in whole units. */
  presets: number[];
}

export const TOKENS: TokenInfo[] = [
  { symbol: "XLM", contract: process.env.PUBLIC_XLM_SAC ?? "", classic: null, decimals: 7, presets: [1, 5, 10, 25] },
  {
    symbol: "USDC",
    contract: process.env.PUBLIC_USDC_SAC ?? "",
    classic: {
      code: "USDC",
      issuer:
        network === "mainnet"
          ? "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
          : "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
    decimals: 7,
    presets: [0.5, 1, 2, 5],
  },
].filter((t): t is TokenInfo => !!t.contract) as TokenInfo[];

export const tokenByContract = (id: string) => TOKENS.find((t) => t.contract === id);

/** Mirrors the contract's limits, so the form refuses what the chain would. */
export const LIMITS = {
  handleMin: 3,
  handleMax: 24,
  nameMax: 48,
  bioMax: 160,
  messageMax: 140,
  /** Smallest tip the fee sponsor covers, in raw units. Mirrors SPONSOR_MIN_TIP_RAW. */
  minTipRaw: 1_000_000n,
} as const;

export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
