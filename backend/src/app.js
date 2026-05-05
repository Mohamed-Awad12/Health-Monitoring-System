const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const crypto = require("crypto");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");
const env = require("./config/env");
const { getCsrfToken } = require("./middlewares/csrf");
const enforceHttps = require("./middlewares/enforceHttps");
const errorHandler = require("./middlewares/errorHandler");
const { globalApiLimiter } = require("./middlewares/rateLimits");
const notFound = require("./middlewares/notFound");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const { setCachingHeaders } = require("./utils/httpCache");

const app = express();

const isRailwayRuntime = Boolean(
  process.env.RAILWAY_PUBLIC_DOMAIN ||
  process.env.RAILWAY_SERVICE_ID ||
  process.env.RAILWAY_ENVIRONMENT
);

if (env.NODE_ENV === "production" || isRailwayRuntime) {
  // Reverse proxies (Railway, etc.) forward the original client IP in headers.
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
}

app.disable("x-powered-by");
app.set("etag", "strong");

const developmentOriginPattern =
  /^https?:\/\/((localhost|127\.0\.0\.1)|((10|192\.168|172\.(1[6-9]|2\d|3[0-1]))(\.\d{1,3}){2})|([a-z0-9-]+\.local))(\:\d+)?$/i;

const normalizeOrigin = (origin) => origin.replace(/\/$/, "");

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const captchaCspSources =
  env.CAPTCHA_PROVIDER === "hcaptcha"
    ? {
        script: ["https://js.hcaptcha.com", "https://hcaptcha.com", "https://*.hcaptcha.com"],
        frame: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
        connect: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
      }
    : env.CAPTCHA_PROVIDER === "recaptcha"
      ? {
          script: [
            "https://www.google.com",
            "https://www.gstatic.com",
            "https://www.recaptcha.net",
          ],
          frame: ["https://www.google.com", "https://www.recaptcha.net"],
          connect: ["https://www.google.com", "https://www.recaptcha.net"],
        }
      : { script: [], frame: [], connect: [] };

const isCorsOriginAllowed = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.includes("*") || allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  return (
    env.NODE_ENV !== "production" &&
    developmentOriginPattern.test(normalizedOrigin)
  );
};

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});
app.use(enforceHttps);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isCorsOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
    hsts: env.ENFORCE_HTTPS
      ? {
          maxAge: 15552000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "blob:"],
        scriptSrc: ["'self'", ...captchaCspSources.script],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          ...allowedOrigins,
          "ws:",
          "wss:",
          ...captchaCspSources.connect,
        ],
        frameSrc: ["'self'", ...captchaCspSources.frame],
        formAction: ["'self'"],
        ...(env.ENFORCE_HTTPS
          ? {
              upgradeInsecureRequests: [],
            }
          : {}),
      },
    },
  })
);
app.use(
  compression({
    threshold: 1024,
  })
);
app.use(globalApiLimiter);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));
app.use(mongoSanitize());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  setCachingHeaders(res, {
    scope: "public",
    maxAge: 30,
    staleWhileRevalidate: 60,
  });
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/auth/csrf-token", getCsrfToken);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
