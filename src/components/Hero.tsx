import type { ReactNode } from "react";

import { Lockup } from "@/components/Logo";
import { C, FONT } from "@/lib/design";

const RIBBON =
  "linear-gradient(90deg,transparent 0,rgba(255,201,74,.02) 30%,rgba(255,220,140,.75) 47%,#fff4d6 50%,rgba(255,210,120,.7) 53%,rgba(255,201,74,.02) 70%,transparent)";

const PARTNERS = ["Stellar", "Soroban", "Fee bump", "USDC", "XLM", "Freighter", "LOBSTR", "xBull", "Albedo", "Rise In"];

const NAV: [string, string][] = [
  ["How it works", "/#how"],
  ["Gasless", "/#gasless"],
  ["Creators", "/#creators"],
  ["FAQ", "/#faq"],
];

export function TopNav() {
  return (
    <header
      style={{
        position: "fixed",
        top: 14,
        left: 0,
        right: 0,
        zIndex: 30,
        display: "flex",
        justifyContent: "center",
        padding: "0 16px",
        pointerEvents: "none",
      }}
    >
      <nav
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 6px 6px 18px",
          borderRadius: 999,
          background: "rgba(14,14,16,.92)",
          border: `1px solid ${C.line}`,
          backdropFilter: "blur(18px)",
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
          maxWidth: "100%",
        }}
      >
        <a href="/" style={{ display: "flex", alignItems: "center", marginRight: 12, textDecoration: "none" }}>
          <Lockup colour={C.white} size={24} />
        </a>
        <div className="nav-links" style={{ display: "flex" }}>
          {NAV.map(([label, href]) => (
            <a
              key={href}
              href={href}
              style={{
                padding: "10px 13px",
                fontSize: 13.5,
                fontWeight: 600,
                color: C.white,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </a>
          ))}
        </div>
        <PillLink href="/app" primary small>
          Open your jar
        </PillLink>
      </nav>
    </header>
  );
}

export function Hero({ stats }: { stats: [string, string][] }) {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "1fr auto",
        background: "radial-gradient(ellipse at 50% 100%,#1f1a0c,#050505 70%)",
      }}
    >
      <Ribbon side="left" />
      <Ribbon side="right" />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 45%,transparent 30%,rgba(5,5,5,.9) 75%)",
          pointerEvents: "none",
        }}
      />
      <FloatingStars />

      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: "170px 24px 60px",
        }}
      >
        <div style={{ maxWidth: 1000 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 26,
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: C.sun,
              animation: "blurIn 1.2s cubic-bezier(.2,.8,.2,1) both",
            }}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: "50%", background: C.sun, animation: "pulse 2s infinite" }}
            />
            Live on Stellar · fees on us
          </div>

          <h1
            style={{
              fontSize: "clamp(40px,6vw,88px)",
              lineHeight: 1.02,
              fontWeight: 500,
              letterSpacing: "-.04em",
              margin: "0 0 26px",
              textWrap: "balance",
            }}
          >
            <Words text="Tip any creator." from={0.15} />
            <br />
            <Words text="Pay zero gas." from={0.45} accent />
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.62,
              color: "rgba(255,255,255,.72)",
              maxWidth: 680,
              margin: "0 auto 36px",
              fontWeight: 500,
              animation: "blurIn 1.2s cubic-bezier(.2,.8,.2,1) .5s both",
            }}
          >
            A jar is a link a creator shares. A fan opens it, picks an amount in XLM or USDC, adds a line of thanks
            and signs once. The money lands in the creator&apos;s wallet in five seconds.{" "}
            <b style={{ color: C.white }}>The network fee is paid by StarJar, not by either of you.</b>
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              animation: "blurIn 1.2s cubic-bezier(.2,.8,.2,1) .7s both",
            }}
          >
            <PillLink href="/app" primary>
              Open your jar
            </PillLink>
            <PillLink href="#how">See how it works</PillLink>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: 1100,
          width: "100%",
          margin: "0 auto",
          padding: "0 32px 48px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 24,
          animation: "blurIn 1.2s cubic-bezier(.2,.8,.2,1) .95s both",
        }}
      >
        {stats.map(([value, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "clamp(32px,3.2vw,48px)", fontWeight: 500, letterSpacing: "-.04em", lineHeight: 1 }}>
              {value}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.7)", lineHeight: 1.3, maxWidth: 130 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: `linear-gradient(90deg,${C.coral},${C.sun},#fff4d6,${C.sun},${C.coral})`,
        }}
      />
    </section>
  );
}

export function Marquee() {
  return (
    <section
      style={{
        background: C.paper,
        color: C.ink,
        padding: "30px 0",
        overflow: "hidden",
        maskImage: "linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)",
        WebkitMaskImage: "linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)",
      }}
    >
      <div style={{ display: "flex", gap: 72, width: "max-content", animation: "marquee 34s linear infinite", alignItems: "center" }}>
        {[...PARTNERS, ...PARTNERS].map((p, i) => (
          <span key={i} style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: C.grey, whiteSpace: "nowrap" }}>
            {p}
          </span>
        ))}
      </div>
    </section>
  );
}

export function PillLink({
  children,
  href,
  primary,
  small,
}: {
  children: ReactNode;
  href: string;
  primary?: boolean;
  small?: boolean;
}) {
  const knob = small ? 30 : 34;
  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: small ? 10 : 14,
        background: primary ? C.sun : "rgba(255,255,255,.06)",
        border: primary ? 0 : "1px solid rgba(255,255,255,.12)",
        color: primary ? C.ink : C.white,
        borderRadius: 999,
        padding: small ? "6px 6px 6px 18px" : "8px 8px 8px 22px",
        fontSize: small ? 13.5 : 15.5,
        fontWeight: 700,
        textDecoration: "none",
        whiteSpace: "nowrap",
        backdropFilter: "blur(10px)",
      }}
    >
      <span>{children}</span>
      <span
        style={{
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: primary ? C.ink : C.sun,
          color: primary ? C.sun : C.ink,
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        →
      </span>
    </a>
  );
}

function Ribbon({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <div
      style={{
        position: "absolute",
        [left ? "left" : "right"]: left ? "-12%" : "-8%",
        top: left ? "-30%" : "-40%",
        width: left ? "24vw" : "20vw",
        height: left ? "170vh" : "180vh",
        transform: `rotate(${left ? 22 : 18}deg)`,
        background: RIBBON,
        filter: "blur(1.5px)",
        opacity: left ? 0.55 : 0.5,
        animation: `${left ? "ribbonL" : "ribbonR"} ${left ? 30 : 34}s ease-in-out infinite`,
        pointerEvents: "none",
      }}
    />
  );
}

/** A few sparkles drifting over the hero; decorative only. */
function FloatingStars() {
  const stars = [
    { x: "14%", y: "28%", s: 18, d: 0 },
    { x: "82%", y: "22%", s: 26, d: 1.2 },
    { x: "74%", y: "64%", s: 14, d: 2.1 },
    { x: "22%", y: "70%", s: 22, d: 0.6 },
    { x: "50%", y: "14%", s: 12, d: 1.7 },
  ];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {stars.map((st, i) => (
        <svg
          key={i}
          viewBox="0 0 40 40"
          width={st.s}
          height={st.s}
          style={{
            position: "absolute",
            left: st.x,
            top: st.y,
            animation: `floatStar ${6 + i}s ease-in-out ${st.d}s infinite`,
            opacity: 0.85,
          }}
        >
          <path d="M20 0 C22 14 26 18 40 20 C26 22 22 26 20 40 C18 26 14 22 0 20 C14 18 18 14 20 0 Z" fill={C.sun} />
        </svg>
      ))}
    </div>
  );
}

/** The headline, one word at a time, so the first thing on screen is motion. */
function Words({ text, from, accent }: { text: string; from: number; accent?: boolean }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="hero-word"
          style={{
            color: accent ? C.sun : undefined,
            animationDelay: `${(from + i * 0.07).toFixed(2)}s`,
            marginRight: "0.26em",
          }}
        >
          {word}
        </span>
      ))}
    </>
  );
}
