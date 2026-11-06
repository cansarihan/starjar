import { PillLink, TopNav } from "@/components/Hero";
import { C } from "@/lib/design";

export default function NotFound() {
  return (
    <main style={{ background: C.black, color: C.white, minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <TopNav />
      <div>
        <h1 style={{ fontSize: "clamp(36px,5vw,64px)", letterSpacing: "-.04em", fontWeight: 500, margin: "0 0 12px" }}>
          No jar here <span style={{ color: C.sun }}>yet.</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,.65)", margin: "0 0 28px" }}>That handle is free. It could be yours.</p>
        <PillLink href="/app" primary>
          Claim it
        </PillLink>
      </div>
    </main>
  );
}
