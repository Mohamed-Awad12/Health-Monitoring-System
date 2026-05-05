const setCachingHeaders = (res, { scope = "private", maxAge = 0, staleWhileRevalidate = 0 } = {}) => {
  const directives = [`${scope}`, `max-age=${Math.max(0, maxAge)}`];

  if (staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  if (maxAge === 0 && staleWhileRevalidate === 0) {
    directives.push("must-revalidate");
  }

  res.setHeader("Cache-Control", directives.join(", "));
};

const setNoStoreHeaders = (res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
};

const applyLastModified = (res, value) => {
  if (!value) {
    return;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return;
  }

  res.setHeader("Last-Modified", date.toUTCString());
};

module.exports = {
  setCachingHeaders,
  setNoStoreHeaders,
  applyLastModified,
};
