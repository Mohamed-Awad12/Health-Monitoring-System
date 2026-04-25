const { z } = require("zod");

const devicePayloadSchema = z.object({
  deviceSecretId: z.string().trim().min(4).max(120),
  spo2: z.coerce.number().min(0).max(100),
  bpm: z.coerce.number().min(0).max(250),
  timestamp: z.coerce.date().optional(),
});

module.exports = {
  devicePayloadSchema,
};
