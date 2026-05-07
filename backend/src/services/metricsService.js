const startedAt = Date.now();

const counters = {
  totalRequests: 0,
  totalErrors: 0,
  cacheHits: 0,
  cacheMisses: 0,
  activeWebSocketConnections: 0,
};

const incrementTotalRequests = () => {
  counters.totalRequests += 1;
};

const incrementTotalErrors = () => {
  counters.totalErrors += 1;
};

const incrementCacheHit = () => {
  counters.cacheHits += 1;
};

const incrementCacheMiss = () => {
  counters.cacheMisses += 1;
};

const incrementSocketConnections = () => {
  counters.activeWebSocketConnections += 1;
};

const decrementSocketConnections = () => {
  counters.activeWebSocketConnections = Math.max(
    counters.activeWebSocketConnections - 1,
    0
  );
};

const getCacheMetrics = () => {
  const totalCacheReads = counters.cacheHits + counters.cacheMisses;

  return {
    hits: counters.cacheHits,
    misses: counters.cacheMisses,
    hitRate: totalCacheReads ? counters.cacheHits / totalCacheReads : 0,
  };
};

const getSnapshot = () => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);

  return {
    uptime,
    requests: {
      total: counters.totalRequests,
      errors: counters.totalErrors,
      errorRate: counters.totalRequests
        ? counters.totalErrors / counters.totalRequests
        : 0,
    },
    cache: getCacheMetrics(),
    socketConnections: counters.activeWebSocketConnections,
    memory: process.memoryUsage(),
  };
};

module.exports = {
  decrementSocketConnections,
  getCacheMetrics,
  getSnapshot,
  incrementCacheHit,
  incrementCacheMiss,
  incrementSocketConnections,
  incrementTotalErrors,
  incrementTotalRequests,
};
