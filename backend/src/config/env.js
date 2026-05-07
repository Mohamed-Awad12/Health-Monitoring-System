const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const booleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return /^(1|true|yes|on)$/i.test(value.trim());
  }

  return false;
}, z.boolean());

const webhookUrlSchema = z.string().url().refine((value) => value.startsWith("https://"), {
  message: "EMAIL_WEBHOOK_URL must use https://",
});

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(5000),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    REFRESH_TOKEN_SECRET: z
      .string()
      .min(16, "REFRESH_TOKEN_SECRET must be at least 16 characters")
      .default("change-this-refresh-token-secret"),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    ENFORCE_HTTPS: booleanSchema.default(false),
    AUTH_COOKIE_NAME: z.string().trim().min(1).default("pulse_session"),
    AUTH_COOKIE_DOMAIN: z.string().trim().optional().or(z.literal("")),
    AUTH_COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
    AUTH_COOKIE_SECURE: booleanSchema.default(false),
    CSRF_COOKIE_NAME: z.string().trim().min(1).default("pulse_csrf"),
    CSRF_HEADER_NAME: z.string().trim().min(1).default("x-csrf-token"),
    SECURITY_LOG_FILE: z
      .string()
      .trim()
      .default("logs/security-events.log"),
    PATIENT_DASHBOARD_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(15),
    READING_FEED_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(10),
    DIRECTORY_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
    DOCTOR_PATIENTS_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(15),
    REDIS_URL: z.string().trim().default("redis://127.0.0.1:6379"),
    REDIS_ENABLED: booleanSchema.default(false),
    GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    AUTH_ACCOUNT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(8),
    AUTH_WRITE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(90),
    AUTH_WRITE_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(1),
    CAPTCHA_PROVIDER: z.enum(["hcaptcha", "recaptcha"]).optional().or(z.literal("")),
    CAPTCHA_SECRET: z.string().trim().optional().or(z.literal("")),
    CAPTCHA_SITEVERIFY_URL: z.string().trim().url().optional().or(z.literal("")),
    ALERT_DEDUP_MINUTES: z.coerce.number().int().positive().default(5),
    PATIENT_LOW_SPO2_THRESHOLD: z.coerce.number().default(90),
    PATIENT_LOW_BPM_THRESHOLD: z.coerce.number().default(50),
    PATIENT_HIGH_BPM_THRESHOLD: z.coerce.number().default(120),
    EMAIL_ALERTS_ENABLED: z.string().default("true"),
    EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),
    PASSWORD_RESET_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    EMAIL_VERIFICATION_URL: z.string().optional(),
    EMAIL_WEBHOOK_URL: webhookUrlSchema.optional().or(z.literal("")),
    EMAIL_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    EMAIL_WEBHOOK_AUTH_HEADER: z.string().optional().or(z.literal("")),
    EMAIL_WEBHOOK_AUTH_VALUE: z.string().optional().or(z.literal("")),
    VAPID_PUBLIC_KEY: z.string().trim().optional().or(z.literal("")),
    VAPID_PRIVATE_KEY: z.string().trim().optional().or(z.literal("")),
    VAPID_EMAIL: z.string().trim().optional().or(z.literal("")),
    ADMIN_BOOTSTRAP_TOKEN: z
      .string()
      .trim()
      .min(16, "ADMIN_BOOTSTRAP_TOKEN must be at least 16 characters")
      .optional()
      .or(z.literal("")),
    AI_HEALTH_ASSISTANT_API_KEY: z.string().optional(),
    AI_HEALTH_ASSISTANT_MODEL: z.string().default("gpt-4o-mini"),
    AI_HEALTH_ASSISTANT_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    AI_HEALTH_ASSISTANT_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  })
  .passthrough();

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.message).join(", ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const config = parsed.data;

config.ENFORCE_HTTPS =
  config.ENFORCE_HTTPS || config.NODE_ENV === "production";
config.AUTH_COOKIE_SECURE =
  config.AUTH_COOKIE_SECURE || config.NODE_ENV === "production";

module.exports = config;
