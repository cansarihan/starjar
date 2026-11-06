"use client";

import { useCallback, useEffect, useState } from "react";

import { CONFIG, HANDLE_RE, LIMITS, TOKENS, tokenByContract } from "@/lib/config";
import { C, FONT, shortKey, units } from "@/lib/design";
import { sendSponsored, type SponsorError } from "@/lib/gasless";
import { balances, canHold } from "@/lib/horizon";
import { getCreator, getHandleOf, getRecent, getTotal, ops, type Profile, type Tip } from "@/lib/soroban";
import { useWallet } from "@/lib/useWallet";

interface Jar {
  profile: Profile;
  recent: Tip[];
  totals: [string, bigint][];
  usdcReady: boolean;
}

export function CreatorPanel() {
  const wallet = useWallet();
  const [jar, setJar] = useState<Jar | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (address: string) => {
    setLoadError(null);
    try {
      const handle = await getHandleOf(address);
      if (!handle) return setJar(null);
      const [profile, recent, totals, bal] = await Promise.all([
        getCreator(handle),
        getRecent(handle),
        Promise.all(TOKENS.map(async (t) => [t.symbol, await getTotal(handle, t.contract)] as [string, bigint])),
        balances(address).catch(() => null),
      ]);
      const usdc = TOKENS.find((t) => t.symbol === "USDC");
      setJar(profile ? { profile, recent, totals, usdcReady: usdc ? canHold(bal, usdc) : false } : null);
    } catch {
      setLoadError("Could not reach the Stellar network. Refresh to try again.");
    }
  }, []);

  useEffect(() => {
    if (wallet.address) void load(wallet.address);
    else setJar(undefined);
  }, [wallet.address, load]);

  if (!wallet.address) {
    return (
      <Panel>
        <h1 style={h1}>Open your jar</h1>
        <p style={lead}>
          Connect the Stellar wallet you want tips to land in. Freighter, LOBSTR, xBull, Albedo, Hana and Rabet work.
        </p>
        <PrimaryButton onClick={() => void wallet.connect()} busy={wallet.busy}>
          Connect wallet
        </PrimaryButton>
        {wallet.error && <p style={{ color: C.coral, fontSize: 14 }}>{wallet.error}</p>}
        <p style={{ ...lead, fontSize: 13.5, marginTop: 26 }}>
          New to Stellar? Install{" "}
          <a href="https://www.freighter.app" target="_blank" rel="noreferrer" style={{ color: C.sun }}>
            Freighter
          </a>{" "}
          or{" "}
          <a href="https://lobstr.co" target="_blank" rel="noreferrer" style={{ color: C.sun }}>
            LOBSTR
          </a>
          {CONFIG.network === "mainnet"
            ? ", and add a little XLM so the account exists on the network."
            : ", switch it to testnet and fund the account with friendbot."}
        </p>
      </Panel>
    );
  }

  if (loadError) {
    return (
      <Panel>
        <p style={{ color: C.coral }}>{loadError}</p>
      </Panel>
    );
  }

  if (jar === undefined) {
    return (
      <Panel>
        <p style={lead}>Looking up your jar…</p>
      </Panel>
    );
  }

  if (jar === null) {
    return <RegisterForm address={wallet.address} onDone={() => void load(wallet.address!)} onSwitch={() => void wallet.disconnect()} />;
  }

  return <Dashboard jar={jar} address={wallet.address} onSwitch={() => void wallet.disconnect()} />;
}

function RegisterForm({ address, onDone, onSwitch }: { address: string; onDone: () => void; onSwitch: () => void }) {
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [taken, setTaken] = useState<boolean | null | "error">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOk = HANDLE_RE.test(handle);
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const nameOk = bytes(name.trim()) > 0 && bytes(name.trim()) <= LIMITS.nameMax;
  const bioOk = bytes(bio.trim()) <= LIMITS.bioMax;

  useEffect(() => {
    setTaken(null);
    if (!handleOk) return;
    const t = setTimeout(() => {
      getCreator(handle)
        .then((p) => setTaken(!!p))
        .catch(() => setTaken("error"));
    }, 350);
    return () => clearTimeout(t);
  }, [handle, handleOk]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await sendSponsored(address, ops.register(address, handle, name.trim(), bio.trim()));
      onDone();
    } catch (e) {
      setError((e as SponsorError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <h1 style={h1}>Claim your handle</h1>
      <p style={lead}>One jar per wallet. The handle is permanent, so pick the one you use everywhere.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: "grid", gap: 18, marginTop: 10 }}
      >
        <label style={{ display: "grid", gap: 8 }}>
          <span style={label}>Handle</span>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 14, color: "rgba(255,255,255,.5)", paddingRight: 8 }}>
              /j/
            </span>
            <input
              className="field"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, LIMITS.handleMax))}
              placeholder="your_name"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <span style={{ fontSize: 12.5, fontFamily: FONT.mono, color: taken === true || taken === "error" ? C.coral : "rgba(255,255,255,.5)" }}>
            {!handle
              ? "3–24 characters: a–z, 0–9, _"
              : !handleOk
                ? "at least 3 characters"
                : taken === null
                  ? "checking…"
                  : taken === "error"
                    ? "could not reach the network, edit the handle to retry"
                    : taken
                      ? "taken"
                      : "available"}
          </span>
        </label>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={label}>Display name</span>
          <input className="field" value={name} maxLength={LIMITS.nameMax} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
        </label>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={label}>
            Bio <span style={{ opacity: 0.5 }}>· optional</span>
          </span>
          <textarea
            className="field"
            rows={3}
            value={bio}
            maxLength={LIMITS.bioMax}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you make, in a sentence"
          />
        </label>
        <PrimaryButton type="submit" busy={busy} disabled={!handleOk || taken !== false || !nameOk || !bioOk}>
          Open jar · no fee
        </PrimaryButton>
        {error && <p style={{ color: C.coral, fontSize: 14, margin: 0 }}>{error}</p>}
      </form>
      <WalletLine address={address} onSwitch={onSwitch} />
    </Panel>
  );
}

function Dashboard({ jar, address, onSwitch }: { jar: Jar; address: string; onSwitch: () => void }) {
  // The address the creator is actually on, so the link is right on any domain.
  const link = `${window.location.origin}/j/${jar.profile.handle}`;
  const [copied, setCopied] = useState(false);
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Tip me on StarJar: XLM or USDC, no gas fees on @StellarOrg ✦ ${link}`,
  )}`;

  return (
    <Panel wide>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <div style={{ fontFamily: FONT.mono, color: C.sun, fontSize: 13 }}>@{jar.profile.handle}</div>
          <h1 style={{ ...h1, margin: "6px 0 0" }}>{jar.profile.name}</h1>
        </div>
        <a href={`/j/${jar.profile.handle}`} className="chip" style={{ textDecoration: "none" }}>
          View public page →
        </a>
      </div>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          padding: "10px 10px 10px 18px",
        }}
      >
        <code style={{ fontFamily: FONT.mono, fontSize: 14, flex: 1, minWidth: 200, wordBreak: "break-all" }}>{link}</code>
        <button
          className="chip"
          aria-pressed={copied}
          onClick={() => {
            void navigator.clipboard.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a href={tweet} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: "none" }}>
          Share on X
        </a>
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", margin: "30px 0" }}>
        {jar.totals.map(([sym, v]) => (
          <div key={sym}>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-.03em" }}>
              {units(v)} <span style={{ fontSize: 16, opacity: 0.6 }}>{sym}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", fontWeight: 600 }}>received</div>
          </div>
        ))}
      </div>

      {!jar.usdcReady && TOKENS.some((t) => t.symbol === "USDC") && (
        <p style={{ ...lead, fontSize: 14, background: "rgba(255,201,74,.08)", borderRadius: 14, padding: "12px 16px" }}>
          To accept USDC, add a USDC trustline in your wallet. Until then your jar takes XLM only.
        </p>
      )}

      <h2 style={{ fontSize: 13, fontFamily: FONT.mono, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.55)" }}>
        Latest tips
      </h2>
      {jar.recent.length === 0 ? (
        <p style={lead}>Nothing yet. Share the link above.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {jar.recent.map((t) => {
            const tok = tokenByContract(t.token);
            return (
              <li key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 12.5, color: "rgba(255,255,255,.55)" }}>{shortKey(t.from)}</span>{" "}
                  <span style={{ fontSize: 15 }}>{t.message}</span>
                </span>
                <b style={{ color: C.sun, whiteSpace: "nowrap" }}>
                  {units(t.amount)} {tok?.symbol}
                </b>
              </li>
            );
          })}
        </ul>
      )}
      <WalletLine address={address} onSwitch={onSwitch} />
    </Panel>
  );
}

function WalletLine({ address, onSwitch }: { address: string; onSwitch: () => void }) {
  return (
    <div style={{ marginTop: 28, fontSize: 12, color: "rgba(255,255,255,.45)", fontFamily: FONT.mono }}>
      wallet {shortKey(address, 6, 6)} ·{" "}
      <button onClick={onSwitch} style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", padding: 0, font: "inherit" }}>
        switch
      </button>
    </div>
  );
}

function Panel({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      style={{
        maxWidth: wide ? 860 : 560,
        margin: "0 auto",
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 30,
        padding: "clamp(26px,4vw,44px)",
        boxShadow: "0 40px 80px rgba(0,0,0,.45)",
        animation: "blurInA .8s cubic-bezier(.2,.8,.2,1) both",
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  busy,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      style={{
        background: C.sun,
        color: C.ink,
        border: 0,
        borderRadius: 999,
        padding: "16px 24px",
        fontSize: 16,
        fontWeight: 800,
        width: "100%",
      }}
    >
      {busy ? "Waiting for the wallet…" : children}
    </button>
  );
}

const h1 = { fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-.04em", fontWeight: 600, margin: "0 0 12px" } as const;
const lead = { fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,.65)" } as const;
const label = { fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.75)" } as const;
