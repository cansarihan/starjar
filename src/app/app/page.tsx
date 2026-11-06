import type { Metadata } from "next";

import { CreatorPanel } from "@/components/CreatorPanel";
import { TopNav } from "@/components/Hero";
import { Footer } from "@/components/Sections";
import { C } from "@/lib/design";

export const metadata: Metadata = { title: "Your jar" };

export default function AppPage() {
  return (
    <main style={{ background: C.black, color: C.white, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopNav />
      <section
        style={{
          flex: 1,
          padding: "130px 20px 90px",
          background: "radial-gradient(ellipse at 50% 0%, rgba(255,201,74,.14), transparent 55%)",
        }}
      >
        <CreatorPanel />
      </section>
      <Footer />
    </main>
  );
}
