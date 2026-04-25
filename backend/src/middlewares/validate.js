const ApiError = require("../utils/ApiError");

const validate = (schemas) => (req, _res, next) => {
  try {
    for (const [segment, schema] of Object.entries(schemas)) {
      const parsed = schema.safeParse(req[segment]);

      if (!parsed.success) {
        const message = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || segment}: ${issue.message}`)
          .join(", ");

        throw new ApiError(400, message);
      }

      req[segment] = parsed.data;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = validate;
