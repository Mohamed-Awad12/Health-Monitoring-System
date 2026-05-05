class ResponseCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlMs, tags = []) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tags: new Set(tags),
    });

    return value;
  }

  async remember(key, ttlMs, factory, tags = []) {
    const cachedValue = this.get(key);

    if (cachedValue) {
      return cachedValue;
    }

    const value = await factory();
    return this.set(key, value, ttlMs, tags);
  }

  invalidateByTags(tags = []) {
    if (!tags.length) {
      return;
    }

    const tagSet = new Set(tags);

    for (const [key, entry] of this.store.entries()) {
      if ([...entry.tags].some((tag) => tagSet.has(tag))) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

module.exports = new ResponseCache();
