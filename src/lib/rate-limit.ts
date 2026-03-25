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
