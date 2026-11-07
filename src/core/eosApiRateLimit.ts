/**
 * EOS API RATE LIMIT MIDDLEWARE (Layer 0)
 * SPEC-053: Protects all 14 serverless API endpoints from volumetric floods.
 *
 * v2: Fixed X-Forwarded-For IP spoofing and per-endpoint singleton bug.
 *
 * Security fixes:
 *   - X-Forwarded-For trusted ONLY when TRUSTED_PROXY env var matches remote address
 *   - Each withRateLimit() call creates an independent limiter (no global singleton)
 *
 * Zero external runtime dependencies.
 */

import { EosTokenBucketRateLimiter } from "./eosTokenBucketRateLimiter.ts";

/** Minimal request surface needed for keying; matches Node/Vercel handlers. */
export interface RateLimitRequest {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
  readonly socket?: { readonly remoteAddress?: string };
  readonly connection?: { readonly remoteAddress?: string };
}

/** Minimal response surface needed to reject a request. */
export interface RateLimitResponse {
  statusCode?: number;
  status?(code: number): unknown;
  setHeader(name: string, value: string | number): unknown;
  end(body?: string): unknown;
}

export type RateLimitHandler = (req: RateLimitRequest, res: RateLimitResponse) => unknown;

export interface RateLimitConfig {
  /** Max burst tokens. Default: 10. */
  readonly capacity?: number;
  /** Tokens refilled per second. Default: 5. */
  readonly refillPerSecond?: number;
  /** Key function — defaults to client IP (spoofing-resistant). */
  readonly keyFn?: (req: RateLimitRequest) => string;
}

/**
 * Returns the true client IP — resistant to X-Forwarded-For spoofing.
 * X-Forwarded-For is ONLY trusted when the connection originates from a known trusted proxy.
 */
function getTrueClientIp(req: RateLimitRequest): string {
  const remoteAddr = req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? "unknown";

  // Read trusted proxy CIDR list from env (e.g. EOS_TRUSTED_PROXIES=127.0.0.1,::1)
  const trustedProxies = (process.env["EOS_TRUSTED_PROXIES"] ?? "127.0.0.1,::1").split(",").map((p) => p.trim());

  const isTrustedProxy = trustedProxies.includes(remoteAddr);

  if (isTrustedProxy) {
    // Only trust X-Forwarded-For from a known proxy
    const rawXff = req.headers?.["x-forwarded-for"];
    const xff = Array.isArray(rawXff) ? rawXff[0] : rawXff;
    if (xff) {
      const firstIp = xff.split(",")[0]?.trim();
      if (firstIp && firstIp.length > 0) return firstIp;
    }
  }

  // For all other connections, use the TCP remote address directly
  return remoteAddr || "anonymous";
}

/**
 * Wraps a Vercel serverless handler with rate limiting.
 * Returns 429 with Retry-After header when the limit is exceeded.
 * Each call creates an independent limiter instance (no cross-endpoint contamination).
 *
 * @example
 * ```js
 * export default withRateLimit({ capacity: 20, refillPerSecond: 10 })(handler);
 * ```
 */
export function withRateLimit(config: RateLimitConfig = {}) {
  const capacity = config.capacity ?? 10;
  const refillPerSecond = config.refillPerSecond ?? 5;

  // FIXED: per-call limiter instance — no singleton contamination across endpoints
  const limiter = new EosTokenBucketRateLimiter({ capacity, refillPerSecond, maxKeys: 10_000 });

  return function rateLimitedHandler(handler: RateLimitHandler): RateLimitHandler {
    return async function (req: RateLimitRequest, res: RateLimitResponse): Promise<unknown> {
      // Skip rate limiting for OPTIONS pre-flight
      if (req.method === "OPTIONS") {
        return handler(req, res);
      }

      const key = config.keyFn ? config.keyFn(req) : getTrueClientIp(req);
      const decision = limiter.consume(key, 1);

      // Always set rate limit headers
      res.setHeader("X-RateLimit-Limit", String(capacity));
      res.setHeader("X-RateLimit-Remaining", String(decision.remainingTokens));

      if (!decision.granted) {
        res.setHeader("Retry-After", String(Math.ceil(decision.retryAfterSeconds)));
        res.setHeader("X-RateLimit-Policy", `${capacity};w=60`);
        if (typeof res.status === "function") {
          res.status(429);
        } else {
          res.statusCode = 429;
        }
        return res.end(
          JSON.stringify({
            error: "Rate limit exceeded",
            code: "EOS_RATE_LIMITED",
            retryAfterSeconds: Math.ceil(decision.retryAfterSeconds),
            limit: capacity,
            remaining: 0,
          }),
        );
      }

      return handler(req, res);
    };
  };
}
