const { z } = require("zod");

const devicePayloadSchema = z.object({
  deviceSecretId: z.string().trim().min(4).max(120),
  spo2: z.coerce.number().min(0).max(100),
  bpm: z.coerce.number().min(0).max(250),
  timestamp: z
    .coerce
    .date()
    .refine((value) => value <= new Date(Date.now() + 60 * 1000), {
      message: "timestamp cannot be too far in the future",
    })
    .optional(),
});

module.exports = {
  devicePayloadSchema,
};
