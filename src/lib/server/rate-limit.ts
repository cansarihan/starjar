/**
 * Fixed-window counters in process memory.
 *
 * Enough for one server instance, which is how StarJar runs. On a platform
 * that spreads requests over many instances each one counts on its own, so the
 * effective limit multiplies; the README says so under limitations.
 */
export class WindowLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Counts the hit and says whether it is within the limit. */
  take(key: string, now = Date.now()): { ok: boolean; remaining: number; resetAt: number } {
    const cur = this.hits.get(key);
    const entry = !cur || cur.resetAt <= now ? { count: 0, resetAt: now + this.windowMs } : cur;
    if (entry.count >= this.limit) return { ok: false, remaining: 0, resetAt: entry.resetAt };
    entry.count += 1;
    this.hits.set(key, entry);
    if (this.hits.size > 50_000) this.sweep(now);
    return { ok: true, remaining: this.limit - entry.count, resetAt: entry.resetAt };
  }

  /** Gives a hit back, for requests that were refused after counting. */
  refund(key: string) {
    const cur = this.hits.get(key);
    if (cur && cur.count > 0) cur.count -= 1;
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

/**
 * A daily ceiling on what the sponsor may spend, in stroops. Each transaction
 * is charged at its maximum possible fee before it is submitted, so the ceiling
 * holds even though the network usually charges less.
 */
export class DailyBudget {
  private spent = 0n;
  private day = "";

  constructor(private readonly limit: bigint) {}

  reserve(stroops: bigint, now = new Date()): boolean {
    const today = now.toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.spent = 0n;
    }
    if (this.spent + stroops > this.limit) return false;
    this.spent += stroops;
    return true;
  }

  release(stroops: bigint) {
    this.spent = this.spent > stroops ? this.spent - stroops : 0n;
  }
}

/**
 * The client address as the hosting proxy saw it. `x-real-ip` is set by the
 * proxy itself; in `x-forwarded-for` only the last entry was added by our
 * proxy, everything before it came from the client and can be forged.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain.at(-1) ?? "unknown";
}
