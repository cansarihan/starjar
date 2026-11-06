import type { ReactNode } from "react";

import { PillLink } from "@/components/Hero";
import { CONFIG } from "@/lib/config";
import { C, FONT, shortKey } from "@/lib/design";

function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 12,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: dark ? C.sunDeep : C.sun,
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}

function Title({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <h2
      className="reveal"
      style={{
        fontSize: "clamp(32px,4.4vw,60px)",
        lineHeight: 1.04,
        fontWeight: 500,
        letterSpacing: "-.04em",
        margin: "0 0 22px",
        maxWidth: 820,
        color: dark ? C.ink : C.white,
        textWrap: "balance",
      }}
    >
      {children}
    </h2>
  );
}

const wrap = { maxWidth: 1180, margin: "0 auto", padding: "0 28px" } as const;

const STEPS: [string, string, string][] = [
  [
    "01",
    "Open a jar",
    "Connect a Stellar wallet and claim a handle like starjar/j/ada. One signature, no fee. Your jar is a link you can put in a bio, a stream overlay or a QR code.",
  ],
  [
    "02",
    "Fans tip in seconds",
    "A fan opens the link, picks XLM or USDC, writes up to 140 characters and signs once in their own wallet. They never need XLM for gas.",
  ],
  [
    "03",
    "Money goes straight to you",
    "The contract moves the tip from the fan's wallet to yours in the same call. StarJar never holds funds, so there is nothing to withdraw and nothing to freeze.",
  ],
];

export function HowItWorks() {
  return (
    <section id="how" style={{ background: C.black, padding: "120px 0" }}>
      <div style={wrap}>
        <Eyebrow>How it works</Eyebrow>
        <Title>Three steps, two signatures, zero fees.</Title>
        <div className="grid-3" style={{ marginTop: 48 }}>
          {STEPS.map(([n, h, p], i) => (
            <article
              key={n}
              className={`card reveal${i ? `-${i + 1}` : ""}`}
              style={{
                background: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 26,
                padding: 30,
                minHeight: 270,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <span style={{ fontFamily: FONT.mono, color: C.sun, fontSize: 13 }}>{n}</span>
              <h3 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em", margin: 0 }}>{h}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,.68)", margin: 0 }}>{p}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Gasless() {
  const rows: [string, string, string][] = [
    ["You sign", "the contract call", "tip(from, handle, token, amount, message)"],
    ["StarJar checks", "it is a StarJar call, by you, for you", "one op · this contract · source = caller"],
    ["StarJar simulates", "so it only pays for calls that succeed", "simulateTransaction"],
    ["StarJar wraps", "your envelope in a fee bump", "FeeBumpTransaction · fee source = sponsor"],
    ["Stellar settles", "in about five seconds", "SUCCESS · tip event emitted"],
  ];
  return (
    <section id="gasless" style={{ background: C.paper, color: C.ink, padding: "120px 0" }}>
      <div style={wrap} className="split-wide">
        <div>
          <Eyebrow dark>Fee sponsorship</Eyebrow>
          <Title dark>Your signature, our fee.</Title>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "rgba(10,10,10,.7)", maxWidth: 520 }}>
            Stellar lets one account pay the fee for another account&apos;s transaction without touching what it
            does. That is a fee bump. Your wallet signs the tip; the StarJar sponsor signs a second envelope around it
            that says only &quot;I pay the fee&quot;. The sponsor cannot change the amount, the recipient or the
            message, because your signature covers all of them.
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "rgba(10,10,10,.7)", maxWidth: 520 }}>
            The sponsor pays only for calls to the StarJar contract, made by the person who signed them, that pass a
            simulation first. Each wallet gets a daily allowance.
          </p>
        </div>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {rows.map(([who, what, tech], i) => (
            <li
              key={who}
              className={`reveal${i % 3 ? `-${(i % 3) + 1}` : ""}`}
              style={{
                background: C.white,
                border: "1px solid rgba(10,10,10,.08)",
                borderRadius: 20,
                padding: "18px 22px",
                display: "grid",
                gridTemplateColumns: "34px 1fr",
                gap: 14,
                alignItems: "start",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: C.ink,
                  color: C.sun,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: FONT.mono,
                  fontSize: 13,
                }}
              >
                {i + 1}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16.5 }}>
                  {who} <span style={{ fontWeight: 500, color: "rgba(10,10,10,.65)" }}>{what}</span>
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 12, color: C.sunDeep, marginTop: 6 }}>{tech}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ForCreators() {
  const points: [string, string][] = [
    ["Non-custodial", "Tips go wallet to wallet inside one contract call. Nobody can hold, delay or claw them back."],
    ["Messages on chain", "Every tip carries a short note that lives on Stellar with the payment."],
    ["XLM and USDC", "Take tips in the native asset or a dollar stablecoin. Add a USDC trustline to accept dollars."],
    ["Any wallet", "Freighter, LOBSTR, xBull, Albedo, Hana and Rabet all work through one connect button."],
  ];
  return (
    <section id="creators" style={{ background: C.black, padding: "120px 0" }}>
      <div style={wrap}>
        <Eyebrow>For creators</Eyebrow>
        <Title>A jar that pays out the moment someone fills it.</Title>
        <div className="split" style={{ marginTop: 40 }}>
          {points.map(([h, p], i) => (
            <div
              key={h}
              className={`card reveal${i % 2 ? "-2" : ""}`}
              style={{ border: `1px solid ${C.line}`, borderRadius: 22, padding: "26px 28px", background: C.panel }}
            >
              <h3 style={{ margin: "0 0 10px", fontSize: 21, letterSpacing: "-.02em" }}>{h}</h3>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,.66)" }}>{p}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 42 }}>
          <PillLink href="/app" primary>
            Claim your handle
          </PillLink>
        </div>
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  [
    "Do I need XLM to use StarJar?",
    "To tip you need the amount you are sending, in XLM or USDC, and a Stellar account that exists. You do not need anything extra for fees. Opening a jar costs nothing.",
  ],
  [
    "Does StarJar take a cut?",
    "No. The contract sends the full amount to the creator. There is no platform fee.",
  ],
  [
    "Who can see my tip?",
    "Everyone. Stellar is a public ledger: the sender, the amount and the message are visible on any explorer. Don't put anything private in a message.",
  ],
  [
    "What happens if StarJar disappears?",
    "Tips already sent are in creators' wallets; there is nothing held by StarJar. The contract stays on chain and can still be called directly with any Stellar tool, paying your own fee.",
  ],
  [
    "Why can't I tip in USDC?",
    "The creator's wallet needs a USDC trustline to receive it, and yours needs USDC to send it. The jar page only offers USDC when the creator can receive it.",
  ],
];

export function Faq() {
  return (
    <section id="faq" style={{ background: C.black, padding: "40px 0 120px" }}>
      <div style={{ ...wrap, maxWidth: 900 }}>
        <Eyebrow>FAQ</Eyebrow>
        <Title>Questions people ask before their first tip.</Title>
        <div style={{ marginTop: 30, borderTop: `1px solid ${C.line}` }}>
          {FAQ.map(([q, a]) => (
            <details key={q} style={{ borderBottom: `1px solid ${C.line}`, padding: "22px 4px" }}>
              <summary style={{ fontSize: 19, fontWeight: 700, cursor: "pointer", listStyle: "none" }}>{q}</summary>
              <p style={{ margin: "14px 0 0", fontSize: 15.5, lineHeight: 1.65, color: "rgba(255,255,255,.68)" }}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section style={{ background: C.black, padding: "0 0 40px" }}>
      <div style={wrap}>
        <div
          className="reveal"
          style={{
            borderRadius: 34,
            padding: "clamp(36px,6vw,72px)",
            background: `radial-gradient(ellipse at 80% 0%, rgba(255,201,74,.28), transparent 60%), ${C.panel}`,
            border: `1px solid ${C.line}`,
            display: "grid",
            gap: 26,
          }}
        >
          <Title>Put a jar where your audience already is.</Title>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PillLink href="/app" primary>
              Open your jar
            </PillLink>
            <PillLink href="https://github.com/cansarihan/starjar">Read the code</PillLink>
          </div>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 18,
              margin: "12px 0 0",
              fontFamily: FONT.mono,
              fontSize: 12.5,
            }}
          >
            <Fact k="Network" v={CONFIG.network} />
            <Fact
              k="Contract"
              v={CONFIG.contractId ? shortKey(CONFIG.contractId, 6, 6) : "not deployed"}
              href={CONFIG.contractId ? `${CONFIG.explorer}/contract/${CONFIG.contractId}` : undefined}
            />
            <Fact k="Platform fee" v="0%" />
            <Fact k="Network fee for you" v="0 XLM" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Fact({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div>
      <dt style={{ color: "rgba(255,255,255,.45)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11 }}>
        {k}
      </dt>
      <dd style={{ margin: "6px 0 0", color: C.white }}>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" style={{ color: C.sun }}>
            {v}
          </a>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}

/** The closing wordmark: one word, large enough to read as a full stop. */
export function Wordmark() {
  return (
    <div
      aria-hidden
      style={{
        overflow: "hidden",
        padding: "clamp(50px,8vw,90px) 32px 0",
        display: "flex",
        justifyContent: "center",
        alignItems: "end",
        lineHeight: 0.8,
      }}
    >
      <div
        style={{
          fontSize: "clamp(90px,22vw,340px)",
          fontWeight: 800,
          letterSpacing: "-.06em",
          color: "transparent",
          background: "linear-gradient(180deg,#2a2412,#080808)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          transform: "translateY(12%)",
          userSelect: "none",
        }}
      >
        starjar
      </div>
    </div>
  );
}

export function Footer() {
  const items = [
    CONFIG.contractId ? `contract ${shortKey(CONFIG.contractId, 4, 4)}` : "contract",
    `stellar ${CONFIG.network}`,
    "soroban · fee bump",
  ];
  return (
    <footer
      style={{
        padding: "26px 28px 30px",
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        fontSize: 11.5,
        color: "rgba(255,255,255,.42)",
        fontFamily: FONT.mono,
        background: C.black,
      }}
    >
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <a href="https://github.com/cansarihan/starjar" style={{ textDecoration: "none" }}>
          github
        </a>
        <span>starjar · built on Stellar</span>
      </div>
    </footer>
  );
}
