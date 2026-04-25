const { z } = require("zod");

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier");
const rangeSchema = z.enum(["day", "week", "month"]).default("day");
const alertStatusSchema = z.enum(["open", "acknowledged", "all"]).default("all");

const linkDeviceSchema = z.object({
  deviceSecretId: z.string().trim().min(4).max(120),
  label: z.string().trim().max(80).optional().or(z.literal("")),
});

const assignDoctorSchema = z.object({
  doctorId: objectIdSchema,
});

const doctorListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(5).max(50).default(12),
});

const patientDashboardQuerySchema = z.object({
  range: rangeSchema.optional(),
});

const alertQuerySchema = z.object({
  status: alertStatusSchema.optional(),
});

const reportQuerySchema = z.object({
  range: rangeSchema.optional(),
  format: z.enum(["csv", "pdf"]).default("csv"),
});

const assistantReportSchema = z.object({
  spo2: z.coerce.number().min(50).max(100),
  bpm: z.coerce.number().int().min(20).max(220),
  trend: z.enum(["increasing", "stable", "decreasing"]).default("stable"),
});

const alertParamsSchema = z.object({
  alertId: objectIdSchema,
});

const assignmentParamsSchema = z.object({
  assignmentId: objectIdSchema,
});

module.exports = {
  objectIdSchema,
  linkDeviceSchema,
  assignDoctorSchema,
  doctorListQuerySchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  reportQuerySchema,
  assistantReportSchema,
  alertParamsSchema,
  assignmentParamsSchema,
};
