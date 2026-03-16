// ─── rate-limit.ts ────────────────────────────────────────────────────────────
//
// Simple in-memory sliding-window rate limiter for Next.js route handlers.
//
// DESIGN
// ─────────────────────────────────────────────────────────────────────────────
// Uses a per-key Map that stores an array of request timestamps within the
// current window. Entries older than `windowMs` are evicted on each check.
//
// This approach is intentionally simple:
//   • Zero external dependencies — no Redis, no Upstash required.
//   • Works correctly in development and single-instance deployments.
//   • In multi-instance serverless (Vercel Edge or multiple Lambda workers)
//     limits are per-instance, not global. This is acceptable for the current
//     scale; replace with @upstash/ratelimit when true global limiting is needed.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────────
//
//   const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 })
//
//   export async function POST(req: NextRequest) {
//     const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
//     if (!limiter.check(ip)) {
//       return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
//     }
//     // ... handler logic
//   }

interface RateLimiterOptions {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface RateLimiter {
  /**
   * Check whether the key is within the rate limit.
   * Increments the counter. Returns true if the request is allowed,
   * false if the limit has been exceeded.
   */
  check(key: string): boolean;
}

/**
 * Create a sliding-window rate limiter.
 *
 * @param options.limit     Maximum number of requests per window.
 * @param options.windowMs  Window duration in milliseconds.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  // Map from key → array of timestamps within the current window
  const store = new Map<string, number[]>();

  return {
    check(key: string): boolean {
      const now = Date.now();
      const cutoff = now - windowMs;

      const timestamps = (store.get(key) ?? []).filter((t) => t > cutoff);
      timestamps.push(now);
      store.set(key, timestamps);

      return timestamps.length <= limit;
    },
  };
}

/**
 * Extract the best available client IP from a request.
 * Prefers the first entry in x-forwarded-for (set by Vercel/proxies),
 * falls back to a generic string if unavailable.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may be "ip1, ip2, ip3" — leftmost is the real client
    return forwarded.split(",")[0]!.trim();
  }
  return "unknown";
}
