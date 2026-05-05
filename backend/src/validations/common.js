const { z } = require("zod");

const collapseWhitespace = (value) => value.replace(/\s+/g, " ").trim();

const plainTextString = (label, { min = 0, max = 255 } = {}) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !/[<>]/.test(value), {
      message: `${label} cannot contain HTML-like markup`,
    })
    .transform((value) => collapseWhitespace(value));

const optionalPlainTextString = (label, maxLength) =>
  plainTextString(label, { max: maxLength }).optional().or(z.literal(""));

const captchaTokenSchema = z
  .string()
  .trim()
  .min(10)
  .max(4096)
  .optional()
  .or(z.literal(""));

module.exports = {
  collapseWhitespace,
  plainTextString,
  optionalPlainTextString,
  captchaTokenSchema,
};
