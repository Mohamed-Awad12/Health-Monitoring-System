const { z } = require("zod");
const { ROLES } = require("../constants/roles");
const { objectIdSchema } = require("./patientValidation");

const passwordSchema = z.string().min(8).max(128);
const emailSchema = z.string().trim().toLowerCase().email();
const nameSchema = z.string().trim().min(2).max(80);
const roleSchema = z.enum(Object.values(ROLES));

const userListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  role: z.enum([...Object.values(ROLES), "all"]).default("all"),
  doctorVerificationStatus: z
    .enum(["all", "not_submitted", "pending", "approved", "rejected"])
    .default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const userParamsSchema = z.object({
  userId: objectIdSchema,
});

const createUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
    specialty: z.string().trim().max(120).optional().or(z.literal("")),
    phone: z.string().trim().max(25).optional().or(z.literal("")),
    emailVerified: z.boolean().optional().default(false),
  })
  .superRefine((payload, ctx) => {
    if (payload.role === ROLES.DOCTOR && !payload.specialty?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["specialty"],
        message: "specialty is required for doctor role",
      });
    }
  });

const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    role: roleSchema.optional(),
    specialty: z.string().trim().max(120).optional().or(z.literal("")),
    phone: z.string().trim().max(25).optional().or(z.literal("")),
    emailVerified: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const reviewDoctorVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(300).optional().or(z.literal("")),
});

module.exports = {
  userListQuerySchema,
  userParamsSchema,
  createUserSchema,
  updateUserSchema,
  reviewDoctorVerificationSchema,
};
