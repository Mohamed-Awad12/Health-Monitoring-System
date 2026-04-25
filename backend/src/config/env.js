const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(5000),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    PATIENT_LOW_SPO2_THRESHOLD: z.coerce.number().default(90),
    PATIENT_LOW_BPM_THRESHOLD: z.coerce.number().default(50),
    PATIENT_HIGH_BPM_THRESHOLD: z.coerce.number().default(120),
    EMAIL_ALERTS_ENABLED: z.string().default("true"),
    EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),
    PASSWORD_RESET_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    EMAIL_VERIFICATION_URL: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z.string().default("false"),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
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

module.exports = parsed.data;
