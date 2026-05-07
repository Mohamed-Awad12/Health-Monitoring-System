const env = require("../config/env");
const metricsService = require("./metricsService");

class ResponseCache {
  constructor() {
    this.store = new Map();
    this.redis = null;
    this.redisEnabled = false;
  }

  async connect() {
    if (!env.REDIS_ENABLED || this.redis) {
      return;
    }

    const Redis = require("ioredis");
    this.redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });

    this.redis.on("error", () => {});
    await this.redis.connect();
    this.redisEnabled = true;
  }

  getCacheKey(key) {
    return `cache:${key}`;
  }

  getTagKey(tag) {
    return `tag:${tag}`;
  }

  async get(key) {
    if (this.redisEnabled) {
      const cachedValue = await this.redis.get(this.getCacheKey(key));

      if (!cachedValue) {
        metricsService.incrementCacheMiss();
        return null;
      }

      metricsService.incrementCacheHit();
      return JSON.parse(cachedValue);
    }

    const entry = this.store.get(key);

    if (!entry) {
      metricsService.incrementCacheMiss();
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      metricsService.incrementCacheMiss();
      return null;
    }

    metricsService.incrementCacheHit();
    return entry.value;
  }

  async set(key, value, ttlMs, tags = []) {
    if (this.redisEnabled) {
      const cacheKey = this.getCacheKey(key);
      const pipeline = this.redis.pipeline();

      pipeline.set(cacheKey, JSON.stringify(value), "PX", ttlMs);

      tags.forEach((tag) => {
        const tagKey = this.getTagKey(tag);
        pipeline.sadd(tagKey, cacheKey);
        pipeline.pexpire(tagKey, ttlMs + 60 * 1000);
      });

      await pipeline.exec();
      return value;
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tags: new Set(tags),
    });

    return value;
  }

  async remember(key, ttlMs, factory, tags = []) {
    const cachedValue = await this.get(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const value = await factory();
    return this.set(key, value, ttlMs, tags);
  }

  invalidateByTags(tags = []) {
    if (!tags.length) {
      return;
    }

    if (this.redisEnabled) {
      this.invalidateRedisByTags(tags).catch(() => {});
      return;
    }

    const tagSet = new Set(tags);

    for (const [key, entry] of this.store.entries()) {
      if ([...entry.tags].some((tag) => tagSet.has(tag))) {
        this.store.delete(key);
      }
    }
  }

  async invalidateRedisByTags(tags) {
    const tagKeys = tags.map((tag) => this.getTagKey(tag));
    const members = await Promise.all(tagKeys.map((tagKey) => this.redis.smembers(tagKey)));
    const cacheKeys = members.flat();
    const keysToDelete = [...new Set([...cacheKeys, ...tagKeys])];

    if (keysToDelete.length) {
      await this.redis.del(keysToDelete);
    }
  }

  clear() {
    if (this.redisEnabled) {
      this.clearRedis().catch(() => {});
      return;
    }

    this.store.clear();
  }

  async clearRedis() {
    const keys = [];
    const scanPattern = async (pattern) => {
      let cursor = "0";

      do {
        const [nextCursor, batchKeys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        cursor = nextCursor;
        keys.push(...batchKeys);
      } while (cursor !== "0");
    };

    await scanPattern("cache:*");
    await scanPattern("tag:*");

    if (keys.length) {
      await this.redis.del([...new Set(keys)]);
    }
  }
}

module.exports = new ResponseCache();
