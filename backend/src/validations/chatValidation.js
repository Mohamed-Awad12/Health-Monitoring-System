const { z } = require("zod");
const { objectIdSchema } = require("./patientValidation");

const normalizeChatBody = (value) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const chatMessageBodySchema = z
  .string()
  .min(1, "Message is required")
  .max(2000, "Message must be 2000 characters or less")
  .transform((value) => normalizeChatBody(value))
  .refine((value) => value.length > 0, {
    message: "Message is required",
  })
  .refine((value) => !/[<>]/.test(value), {
    message: "Message cannot contain HTML-like markup",
  });

const optionalChatMessageBodySchema = z
  .union([z.string(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return "";
    }

    return normalizeChatBody(value);
  })
  .refine((value) => value.length <= 2000, {
    message: "Message must be 2000 characters or less",
  })
  .refine((value) => !/[<>]/.test(value), {
    message: "Message cannot contain HTML-like markup",
  });

const chatConversationParamsSchema = z.object({
  conversationId: objectIdSchema,
});

const chatMessageAttachmentParamsSchema = z.object({
  conversationId: objectIdSchema,
  messageId: objectIdSchema,
});

const chatMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z
    .string()
    .datetime({ offset: true })
    .optional(),
});

const sendChatMessageSchema = z.object({
  body: chatMessageBodySchema,
});

const sendChatAttachmentSchema = z.object({
  body: optionalChatMessageBodySchema.optional(),
});

const chatAttachmentQuerySchema = z.object({
  download: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return /^(1|true|yes|on)$/i.test(value.trim());
      }

      return Boolean(value);
    }, z.boolean())
    .optional(),
});

module.exports = {
  chatMessageBodySchema,
  optionalChatMessageBodySchema,
  chatConversationParamsSchema,
  chatMessageAttachmentParamsSchema,
  chatMessagesQuerySchema,
  sendChatMessageSchema,
  sendChatAttachmentSchema,
  chatAttachmentQuerySchema,
};
