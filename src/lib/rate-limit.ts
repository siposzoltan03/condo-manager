import { redis } from "./redis";

interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Simple sliding-window rate limiter backed by Redis.
 * Uses the INCR + EXPIRE pattern: the first request in a window sets the key
 * with a TTL; subsequent requests increment the counter. Once the counter
 * exceeds `limit` the request is rejected until the TTL expires.
 */
export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;

  const count = await redis.incr(redisKey);

  if (count === 1) {
    // First request in this window — set the expiry
    await redis.expire(redisKey, windowSeconds);
  }

  const ttl = await redis.ttl(redisKey);
  const resetAt = new Date(Date.now() + Math.max(ttl, 0) * 1000);

  return {
    success: count <= limit,
    remaining: Math.max(limit - count, 0),
    resetAt,
  };
}

/**
 * Per-user, per-endpoint mutation rate limit. Apply at the top of any
 * POST/PATCH/DELETE handler that accepts user input. Default: 30
 * mutations / minute / endpoint.
 */
export class RateLimitedError extends Error {
  constructor(public resetAt: Date) {
    super("Rate limit exceeded");
    this.name = "RateLimitedError";
  }
}

export async function rateLimitMutation(
  userId: string,
  endpoint: string,
  opts?: { limit?: number; windowSeconds?: number },
): Promise<void> {
  const limit = opts?.limit ?? 30;
  const windowSeconds = opts?.windowSeconds ?? 60;
  const result = await rateLimit({
    key: `mut:${userId}:${endpoint}`,
    limit,
    windowSeconds,
  });
  if (!result.success) {
    throw new RateLimitedError(result.resetAt);
  }
}

/**
 * Convenience form: returns a 429 Response if rate-limited, otherwise
 * undefined. Use as:
 *   const limited = await rateLimitMutationOrRespond(userId, "endpoint");
 *   if (limited) return limited;
 */
export async function rateLimitMutationOrRespond(
  userId: string,
  endpoint: string,
  opts?: { limit?: number; windowSeconds?: number },
): Promise<Response | undefined> {
  try {
    await rateLimitMutation(userId, endpoint, opts);
    return undefined;
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please slow down.",
          resetAt: err.resetAt.toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(
              Math.max(
                1,
                Math.ceil((err.resetAt.getTime() - Date.now()) / 1000),
              ),
            ),
          },
        },
      );
    }
    throw err;
  }
}
