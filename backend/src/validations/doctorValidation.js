const { z } = require("zod");
const {
  objectIdSchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  alertParamsSchema,
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

module.exports = {
  patientSearchQuerySchema,
  patientParamsSchema,
  assignmentParamsSchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  alertParamsSchema,
};
