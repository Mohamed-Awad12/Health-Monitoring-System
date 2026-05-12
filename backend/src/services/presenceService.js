const activeConnections = new Map();
const lastSeenAt = new Map();
const onlineSince = new Map();

const toKey = (userId) => String(userId);

const addConnection = (userId) => {
  const key = toKey(userId);
  const previousCount = activeConnections.get(key) || 0;
  const nextCount = previousCount + 1;

  activeConnections.set(key, nextCount);

  if (previousCount === 0) {
    onlineSince.set(key, new Date().toISOString());
  }

  return {
    isOnline: true,
    becameOnline: previousCount === 0,
    count: nextCount,
  };
};

const removeConnection = (userId) => {
  const key = toKey(userId);
  const previousCount = activeConnections.get(key) || 0;

  if (previousCount <= 1) {
    activeConnections.delete(key);
    onlineSince.delete(key);
    lastSeenAt.set(key, new Date().toISOString());

    return {
      isOnline: false,
      becameOffline: previousCount > 0,
      count: 0,
    };
  }

  const nextCount = previousCount - 1;
  activeConnections.set(key, nextCount);

  return {
    isOnline: true,
    becameOffline: false,
    count: nextCount,
  };
};

const isOnline = (userId) => activeConnections.has(toKey(userId));

const getPresence = (userId) => {
  const key = toKey(userId);

  return {
    isOnline: isOnline(key),
    onlineSince: onlineSince.get(key) || null,
    lastSeenAt: lastSeenAt.get(key) || null,
  };
};

module.exports = {
  addConnection,
  removeConnection,
  isOnline,
  getPresence,
};
