import { Hero, Marquee, TopNav } from "@/components/Hero";
import { Closing, Faq, Footer, ForCreators, Gasless, HowItWorks, Wordmark } from "@/components/Sections";
import { CONFIG } from "@/lib/config";
import { C } from "@/lib/design";
import { getStats, type Stats } from "@/lib/soroban";

// Stats come from the contract; refreshed at most every 30 seconds.
export const revalidate = 30;

export default async function Home() {
  const stats = await loadStats();
  const v = (n: number | undefined) => (n === undefined ? "··" : new Intl.NumberFormat("en-US").format(n));
  return (
    <main style={{ background: C.black, color: C.white, minHeight: "100vh" }}>
      <TopNav />
      <Hero
        stats={[
          [v(stats?.creators), "jars opened"],
          [v(stats?.tips), "tips sent on chain"],
          [v(stats?.tippers), "different wallets tipping"],
          ["0", "XLM paid in gas by users"],
        ]}
      />
      <Marquee />
      <HowItWorks />
      <Gasless />
      <ForCreators />
      <Faq />
      <Closing />
      <Wordmark />
      <Footer />
    </main>
  );
}

async function loadStats(): Promise<Stats | null> {
  if (!CONFIG.contractId) return null;
  try {
    return await getStats();
  } catch {
    return null;
  }
}
