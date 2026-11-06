/** @type {import('next').NextConfig} */
const config = {
  // The sponsor route signs with a server key and talks to RPC from node;
  // keeping the SDK external avoids bundling it twice.
  serverExternalPackages: ["@stellar/stellar-sdk"],

  // Public values are baked into the client bundle at build time. Anything
  // secret (the sponsor key) is read only in route handlers and never listed here.
  env: {
    PUBLIC_STELLAR_NETWORK: process.env.PUBLIC_STELLAR_NETWORK ?? "testnet",
    PUBLIC_TIPJAR_CONTRACT_ID: process.env.PUBLIC_TIPJAR_CONTRACT_ID ?? "",
    PUBLIC_XLM_SAC: process.env.PUBLIC_XLM_SAC ?? "",
    PUBLIC_USDC_SAC: process.env.PUBLIC_USDC_SAC ?? "",
    PUBLIC_RPC_URL: process.env.PUBLIC_RPC_URL ?? "",
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? "",
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
