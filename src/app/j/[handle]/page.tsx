import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TopNav } from "@/components/Hero";
import { Footer } from "@/components/Sections";
import { TipForm } from "@/components/TipForm";
import { CONFIG, HANDLE_RE, TOKENS, tokenByContract } from "@/lib/config";
import { C, FONT, shortKey, units } from "@/lib/design";
import { balances, canHold } from "@/lib/horizon";
import { getCreator, getRecent, getTotal } from "@/lib/soroban";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `Tip @${handle}`,
    description: `Send @${handle} a tip in XLM or USDC on Stellar. No gas fees.`,
  };
}

export default async function JarPage({ params }: Params) {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle).toLowerCase();
  if (!HANDLE_RE.test(handle)) notFound();

  const profile = await getCreator(handle).catch(() => null);
  if (!profile) notFound();

  const [recent, totals, ownerBalances] = await Promise.all([
    getRecent(handle).catch(() => []),
    Promise.all(TOKENS.map(async (t) => [t, await getTotal(handle, t.contract).catch(() => 0n)] as const)),
    balances(profile.owner).catch(() => null),
  ]);
  const accepted = TOKENS.filter((t) => canHold(ownerBalances, t)).map((t) => t.symbol);

  return (
    <main style={{ background: C.black, color: C.white, minHeight: "100vh" }}>
      <TopNav />
      <section
        style={{
          padding: "130px 24px 80px",
          background: "radial-gradient(ellipse at 50% 0%, rgba(255,201,74,.16), transparent 55%)",
        }}
      >
        <div className="split-wide" style={{ maxWidth: 1100, margin: "0 auto", alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
              <Avatar seed={profile.owner} name={profile.name} />
              <div>
                <h1 style={{ fontSize: "clamp(32px,4vw,52px)", margin: 0, letterSpacing: "-.04em", fontWeight: 600 }}>
                  {profile.name}
                </h1>
                <div style={{ fontFamily: FONT.mono, color: C.sun, fontSize: 14, marginTop: 4 }}>@{profile.handle}</div>
              </div>
            </div>
            {profile.bio && (
              <p style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(255,255,255,.75)", maxWidth: 560 }}>
                {profile.bio}
              </p>
            )}

            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "28px 0 40px" }}>
              {totals.map(([t, v]) => (
                <div key={t.symbol}>
                  <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.03em" }}>
                    {units(v, t.decimals)} <span style={{ fontSize: 16, opacity: 0.6 }}>{t.symbol}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", fontWeight: 600 }}>received in tips</div>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: 15, fontFamily: FONT.mono, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.55)" }}>
              Recent tips
            </h2>
            {recent.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,.55)" }}>No tips yet. Be the first.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {recent.map((tip) => {
                  const t = tokenByContract(tip.token);
                  return (
                    <li
                      key={tip.id}
                      style={{
                        background: C.panel,
                        border: `1px solid ${C.line}`,
                        borderRadius: 18,
                        padding: "16px 18px",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                        <span style={{ fontFamily: FONT.mono, color: "rgba(255,255,255,.6)" }}>{shortKey(tip.from, 4, 4)}</span>
                        <b style={{ color: C.sun }}>
                          {units(tip.amount, t?.decimals ?? 7)} {t?.symbol ?? "?"}
                        </b>
                      </div>
                      {tip.message && <div style={{ fontSize: 15.5, lineHeight: 1.5 }}>{tip.message}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <aside
            style={{
              position: "sticky",
              top: 100,
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 28,
              padding: 28,
              boxShadow: "0 40px 80px rgba(0,0,0,.45)",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 24, letterSpacing: "-.03em" }}>Send a tip</h2>
            <p style={{ margin: "0 0 22px", fontSize: 14, color: "rgba(255,255,255,.6)" }}>
              Goes straight to {profile.name}&apos;s wallet. The network fee is on StarJar.
            </p>
            <TipForm handle={profile.handle} owner={profile.owner} accepted={accepted} />
            {!accepted.includes("USDC") && TOKENS.some((t) => t.symbol === "USDC") && (
              <p style={{ marginTop: 18, fontSize: 12, color: "rgba(255,255,255,.45)" }}>
                USDC tips appear once this creator adds a USDC trustline.
              </p>
            )}
            <a
              href={`${CONFIG.explorer}/account/${profile.owner}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "block", marginTop: 18, fontSize: 12, fontFamily: FONT.mono, color: "rgba(255,255,255,.45)" }}
            >
              creator wallet {shortKey(profile.owner, 6, 6)} ↗
            </a>
          </aside>
        </div>
      </section>
      <Footer />
    </main>
  );
}

/** A deterministic gradient disc from the owner key, with their initial. */
function Avatar({ seed, name }: { seed: string; name: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <div
      aria-hidden
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: `conic-gradient(from ${h}deg, ${C.sun}, hsl(${h} 80% 55%), ${C.coral}, ${C.sun})`,
        display: "grid",
        placeItems: "center",
        fontSize: 30,
        fontWeight: 800,
        color: C.ink,
        flex: "none",
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "★"}
    </div>
  );
}
