const RANGE_CONFIG = {
  day: {
    durationMs: 24 * 60 * 60 * 1000,
    format: "%Y-%m-%d %H:00",
  },
  week: {
    durationMs: 7 * 24 * 60 * 60 * 1000,
    format: "%Y-%m-%d",
  },
  month: {
    durationMs: 30 * 24 * 60 * 60 * 1000,
    format: "%Y-%m-%d",
  },
};

const getRangeConfig = (range = "day") => RANGE_CONFIG[range] || RANGE_CONFIG.day;

const getRangeBounds = (range = "day") => {
  const config = getRangeConfig(range);
  const end = new Date();
  const start = new Date(end.getTime() - config.durationMs);

  return {
    ...config,
    start,
    end,
    range,
  };
};

module.exports = {
  getRangeBounds,
  getRangeConfig,
};
