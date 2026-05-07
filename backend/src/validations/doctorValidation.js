const { z } = require("zod");
const {
  objectIdSchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  alertParamsSchema,
  pushSubscriptionSchema,
} = require("./patientValidation");

const patientSearchQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
});

const patientParamsSchema = z.object({
  patientId: objectIdSchema,
});

const assignmentParamsSchema = z.object({
  assignmentId: objectIdSchema,
});

const thresholdValue = (minimum, maximum) =>
  z.coerce.number().min(minimum).max(maximum).nullable();

const assignmentThresholdsSchema = z
  .object({
    lowSpo2: thresholdValue(50, 100).optional(),
    lowBpm: thresholdValue(10, 300).optional(),
    highBpm: thresholdValue(10, 300).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one threshold is required",
  });

const alertNoteSchema = z.object({
  note: z.string().trim().max(500).nullable(),
});

module.exports = {
  patientSearchQuerySchema,
  patientParamsSchema,
  assignmentParamsSchema,
  assignmentThresholdsSchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  alertParamsSchema,
  alertNoteSchema,
  pushSubscriptionSchema,
};
