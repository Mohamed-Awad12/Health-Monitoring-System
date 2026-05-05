const fs = require("fs/promises");
const path = require("path");
const env = require("../config/env");

const logFilePath = path.resolve(__dirname, "../../", env.SECURITY_LOG_FILE);

const writeSecurityEvent = async (event) => {
  try {
    await fs.mkdir(path.dirname(logFilePath), { recursive: true });
    await fs.appendFile(logFilePath, `${JSON.stringify(event)}\n`, "utf8");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to persist security event", error.message);
  }
};

const logSecurityEvent = (event = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    severity: event.severity || "info",
    type: event.type || "security_event",
    route: event.req?.originalUrl,
    method: event.req?.method,
    ip: event.req?.ip,
    userAgent: event.req?.get?.("user-agent"),
    userId: event.userId || event.req?.user?._id?.toString?.(),
    details: event.details || null,
  };

  void writeSecurityEvent(payload);
};

module.exports = {
  logSecurityEvent,
};
