const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const { logSecurityEvent } = require("../services/securityEventLogger");

const normalizeEmailKey = (value) =>
  typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : "";

const buildLimiter = ({
  windowMs,
  max,
  message,
  keyGenerator,
  eventType,
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
      logSecurityEvent({
        severity: "warning",
        type: eventType,
        req,
        details: {
          max,
          windowMs,
        },
      });

      res.status(429).json({
        message,
      });
    },
  });

const authWindowMs = env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
const writeWindowMs = env.AUTH_WRITE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

const globalApiLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: env.GLOBAL_RATE_LIMIT_MAX,
  message: "Too many requests. Please try again later.",
  eventType: "global_rate_limit_exceeded",
});

const authIpLimiter = buildLimiter({
  windowMs: authWindowMs,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: "Too many authentication attempts. Please try again later.",
  eventType: "auth_ip_rate_limit_exceeded",
});

const authAccountLimiter = buildLimiter({
  windowMs: authWindowMs,
  max: env.AUTH_ACCOUNT_RATE_LIMIT_MAX,
  message: "Too many attempts for this account. Please wait before retrying.",
  keyGenerator: (req) => normalizeEmailKey(req.body?.email) || req.ip,
  eventType: "auth_account_rate_limit_exceeded",
});

const authenticatedWriteLimiter = buildLimiter({
  windowMs: writeWindowMs,
  max: env.AUTH_WRITE_RATE_LIMIT_MAX,
  message: "Too many write operations. Please slow down and try again shortly.",
  keyGenerator: (req) =>
    req.user?._id?.toString?.() || req.ip,
  eventType: "authenticated_write_rate_limit_exceeded",
});

const deviceIngestLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 600,
  keyGenerator: (req) => req.body?.deviceSecretId?.trim?.() || req.ip,
  message: "Too many device readings received in a short period.",
  eventType: "device_ingest_rate_limit_exceeded",
});

module.exports = {
  globalApiLimiter,
  authIpLimiter,
  authAccountLimiter,
  authenticatedWriteLimiter,
  deviceIngestLimiter,
};
