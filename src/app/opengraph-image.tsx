import { ImageResponse } from "next/og";

export const alt = "starjar · gasless tips on Stellar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card, drawn at request time so there is no binary to keep in the repo. */
export default function OpenGraph() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "radial-gradient(ellipse at 50% 120%, #2a2108, #050505 65%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg viewBox="0 0 110 110" width="84" height="84">
            <path d="M36 16 H74" fill="none" stroke="#FFC94A" strokeWidth="11" strokeLinecap="round" />
            <rect x="20" y="30" width="70" height="70" rx="20" fill="none" stroke="#FFC94A" strokeWidth="11" />
            <path d="M55 46 C57 58 61 62 73 65 C61 68 57 72 55 84 C53 72 49 68 37 65 C49 62 53 58 55 46 Z" fill="#FFC94A" />
          </svg>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -4, color: "#FFC94A" }}>starjar</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -3, lineHeight: 1.05 }}>Tip any creator.</div>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -3, lineHeight: 1.05, color: "#FFC94A" }}>
            Pay zero gas.
          </div>
        </div>
        <div style={{ fontSize: 26, color: "rgba(255,255,255,.6)" }}>XLM · USDC · Soroban · fee-bump sponsored</div>
      </div>
    ),
    size,
  );
}
