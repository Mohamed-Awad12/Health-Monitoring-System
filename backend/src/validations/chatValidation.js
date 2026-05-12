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

const chatConversationParamsSchema = z.object({
  conversationId: objectIdSchema,
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

module.exports = {
  chatMessageBodySchema,
  chatConversationParamsSchema,
  chatMessagesQuerySchema,
  sendChatMessageSchema,
};
