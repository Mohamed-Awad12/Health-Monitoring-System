const { z } = require("zod");

const passwordSchema = z.string().min(8).max(128);
const emailSchema = z.string().trim().toLowerCase().email();
const nameSchema = z.string().trim().min(2).max(80);
const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "otp must be a 6-digit code");

const registerPatientSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().max(25).optional().or(z.literal("")),
});

const registerDoctorSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  specialty: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(25).optional().or(z.literal("")),
});

const registerAdminBootstrapSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().max(25).optional().or(z.literal("")),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: z.string().trim().max(25).optional().or(z.literal("")),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
  confirmation: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value === "DELETE", {
      message: "confirmation must be DELETE",
    }),
});

const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

const resendVerificationEmailSchema = z.object({
  email: emailSchema,
});


const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordWithTokenSchema = z.object({
  token: z.string().trim().min(20).max(512),
  password: passwordSchema,
});

const resetPasswordWithOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  password: passwordSchema,
});

const resetPasswordSchema = z.union([
  resetPasswordWithTokenSchema,
  resetPasswordWithOtpSchema,
]);

module.exports = {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationEmailSchema,
  registerPatientSchema,
  registerDoctorSchema,
  registerAdminBootstrapSchema,
  loginSchema,
  updateProfileSchema,
  verifyEmailSchema,
};
