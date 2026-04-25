const { ZodError } = require("zod");

const errorHandler = (error, _req, res, _next) => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      message: "Uploaded file is too large. Maximum size is 5 MB.",
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: error.issues.map((issue) => issue.message).join(", "),
    });
  }

  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }

  if (error.name === "MongoServerError" && error.code === 11000) {
    return res.status(409).json({
      message: "Resource already exists",
      details: error.keyValue,
    });
  }

  const statusCode = error.statusCode || 500;
  const payload = {
    message: error.message || "Internal server error",
  };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(statusCode).json(payload);
};

module.exports = errorHandler;
