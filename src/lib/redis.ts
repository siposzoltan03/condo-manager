import type Redis from "ioredis";

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    // Dynamic require to avoid module-level connection during build
    const IORedis = require("ioredis") as typeof import("ioredis").default;
    _redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return _redis;
}

// Backward-compatible named export — callers using `redis.xxx()` will work
// but connection only happens on first actual use
export const redis = new Proxy({} as Redis, {
  get(_target, prop: string) {
    const instance = getRedis();
    const value = (instance as any)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
