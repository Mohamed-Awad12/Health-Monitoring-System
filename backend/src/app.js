const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");
const env = require("./config/env");
const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");

const app = express();

if (env.NODE_ENV === "production") {
  // Railway terminates TLS upstream and forwards proxy headers.
  app.set("trust proxy", 1);
}

const developmentOriginPattern =
  /^https?:\/\/((localhost|127\.0\.0\.1)|((10|192\.168|172\.(1[6-9]|2\d|3[0-1]))(\.\d{1,3}){2})|([a-z0-9-]+\.local))(\:\d+)?$/i;

const normalizeOrigin = (origin) => origin.replace(/\/$/, "");

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

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
app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
