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
