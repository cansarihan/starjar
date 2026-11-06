"use client";

import { useEffect, useMemo, useState } from "react";

import { CONFIG, LIMITS, TOKENS, type TokenInfo } from "@/lib/config";
import { C, FONT, toRaw } from "@/lib/design";
import { sendSponsored, SponsorError } from "@/lib/gasless";
import { balanceOf, balances } from "@/lib/horizon";
import { ops } from "@/lib/soroban";
import { useWallet } from "@/lib/useWallet";

type Phase =
  | { kind: "idle" }
  | { kind: "working"; step: string }
  | { kind: "done"; hash: string; amount: string; symbol: string }
  | { kind: "error"; message: string; hash?: string };

export function TipForm({
  handle,
  owner,
  accepted,
}: {
  handle: string;
  owner: string;
  /** Token symbols the creator can receive (USDC needs a trustline). */
  accepted: string[];
}) {
  const tokens = useMemo(() => TOKENS.filter((t) => accepted.includes(t.symbol)), [accepted]);
  const wallet = useWallet();
  const [token, setToken] = useState<TokenInfo | undefined>(tokens[0]);
  const [amount, setAmount] = useState(String(tokens[0]?.presets[1] ?? 1));
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [held, setHeld] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.address || !token) return setHeld(null);
    balances(wallet.address)
      .then((b) => setHeld(balanceOf(b, token)))
      .catch(() => setHeld(null));
  }, [wallet.address, token, phase.kind]);

  if (!token) {
    return <p style={{ color: "rgba(255,255,255,.6)" }}>This jar cannot receive any token right now.</p>;
  }

  const own = wallet.address === owner;
  let raw: bigint | null = null;
  try {
    raw = toRaw(amount, token.decimals);
  } catch {
    raw = null;
  }
  const belowMin = raw !== null && raw < LIMITS.minTipRaw;
  const valid = raw !== null && !belowMin && new TextEncoder().encode(message).length <= LIMITS.messageMax;

  async function submit() {
    if (!token || raw === null) return;
    let from = wallet.address;
    if (!from) {
      from = await wallet.connect();
      if (!from) return;
    }
    if (from === owner) {
      setPhase({ kind: "error", message: "This is your own jar. Share it, and let someone else fill it." });
      return;
    }
    try {
      setPhase({ kind: "working", step: "Preparing the transaction" });
      const op = ops.tip(from, handle, token.contract, raw, message.trim());
      setPhase({ kind: "working", step: "Confirm in your wallet. The fee line is paid by StarJar." });
      const res = await sendSponsored(from, op);
      setPhase({ kind: "done", hash: res.hash, amount, symbol: token.symbol });
      setMessage("");
    } catch (e) {
      const err = e as SponsorError;
      setPhase({ kind: "error", message: err.message || "Something went wrong", hash: err.hash });
    }
  }

  if (phase.kind === "done") {
    return (
      <div style={{ textAlign: "center", padding: "26px 8px", animation: "popIn .5s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ fontSize: 54, lineHeight: 1 }} aria-hidden>
          ✦
        </div>
        <h3 style={{ fontSize: 28, margin: "14px 0 8px", letterSpacing: "-.03em" }}>
          {phase.amount} {phase.symbol} sent to @{handle}
        </h3>
        <p style={{ color: "rgba(255,255,255,.65)", margin: "0 0 18px" }}>You paid no network fee.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href={`${CONFIG.explorer}/tx/${phase.hash}`}
            target="_blank"
            rel="noreferrer"
            className="chip"
            style={{ textDecoration: "none" }}
          >
            View on explorer ↗
          </a>
          <button className="chip" onClick={() => setPhase({ kind: "idle" })}>
            Tip again
          </button>
        </div>
      </div>
    );
  }

  const working = phase.kind === "working";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: "grid", gap: 18 }}
    >
      {tokens.length > 1 && (
        <div role="group" aria-label="Token" style={{ display: "flex", gap: 8 }}>
          {tokens.map((t) => (
            <button
              key={t.symbol}
              type="button"
              className="chip"
              aria-pressed={t.symbol === token.symbol}
              onClick={() => {
                setToken(t);
                setAmount(String(t.presets[1]));
              }}
            >
              {t.symbol}
            </button>
          ))}
        </div>
      )}

      <div role="group" aria-label="Amount" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {token.presets.map((p) => (
          <button
            key={p}
            type="button"
            className="chip"
            aria-pressed={amount === String(p)}
            onClick={() => setAmount(String(p))}
          >
            {p} {token.symbol}
          </button>
        ))}
      </div>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={labelStyle}>Amount</span>
        <input
          className="field"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
          aria-invalid={!valid}
        />
        {belowMin && (
          <span style={{ fontSize: 12.5, color: C.coral }}>
            The smallest gasless tip is {Number(LIMITS.minTipRaw) / 10 ** token.decimals} {token.symbol}.
          </span>
        )}
        {held !== null && (
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", fontFamily: FONT.mono }}>
            balance {held} {token.symbol}
          </span>
        )}
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={labelStyle}>
          Message <span style={{ opacity: 0.5 }}>· public, optional</span>
        </span>
        <textarea
          className="field"
          rows={3}
          maxLength={LIMITS.messageMax}
          placeholder="Say thanks…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ resize: "vertical" }}
        />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,.45)", textAlign: "right", fontFamily: FONT.mono }}>
          {new TextEncoder().encode(message).length}/{LIMITS.messageMax}
        </span>
      </label>

      <button
        type="submit"
        disabled={!valid || working || own}
        style={{
          background: C.sun,
          color: C.ink,
          border: 0,
          borderRadius: 999,
          padding: "16px 22px",
          fontSize: 16,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {working ? (
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              border: "2.5px solid rgba(10,10,10,.25)",
              borderTopColor: C.ink,
              borderRadius: "50%",
              animation: "spin .8s linear infinite",
            }}
          />
        ) : null}
        {own
          ? "This is your jar"
          : wallet.address
            ? `Tip ${amount || 0} ${token.symbol} · no gas`
            : "Connect wallet and tip"}
      </button>

      <div aria-live="polite" style={{ minHeight: 20, fontSize: 14 }}>
        {phase.kind === "working" && <span style={{ color: "rgba(255,255,255,.7)" }}>{phase.step}</span>}
        {phase.kind === "error" && (
          <span style={{ color: C.coral }}>
            {phase.message}{" "}
            {phase.hash && (
              <a href={`${CONFIG.explorer}/tx/${phase.hash}`} target="_blank" rel="noreferrer">
                Transaction ↗
              </a>
            )}
          </span>
        )}
        {wallet.error && phase.kind === "idle" && <span style={{ color: C.coral }}>{wallet.error}</span>}
      </div>

      {wallet.address && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", fontFamily: FONT.mono }}>
          signing as {wallet.address.slice(0, 6)}…{wallet.address.slice(-6)} ·{" "}
          <button
            type="button"
            onClick={() => void wallet.disconnect()}
            style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", padding: 0, font: "inherit" }}
          >
            switch
          </button>
        </div>
      )}
    </form>
  );
}

const labelStyle = { fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.75)" } as const;
