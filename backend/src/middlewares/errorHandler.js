const { ZodError } = require("zod");
const metricsService = require("../services/metricsService");
const { logSecurityEvent } = require("../services/securityEventLogger");
const { setNoStoreHeaders } = require("../utils/httpCache");

const errorHandler = (error, req, res, _next) => {
  metricsService.incrementTotalErrors();

  if (error.code === "LIMIT_FILE_SIZE") {
    setNoStoreHeaders(res);
    return res.status(400).json({
      message: "Uploaded file is too large. Maximum size is 5 MB.",
      requestId: req.id,
    });
  }

  if (error instanceof ZodError) {
    setNoStoreHeaders(res);
    return res.status(400).json({
      message: error.issues.map((issue) => issue.message).join(", "),
      requestId: req.id,
    });
  }

  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    setNoStoreHeaders(res);
    return res.status(401).json({
      message: "Invalid or expired token",
      requestId: req.id,
    });
  }

  if (error.name === "MongoServerError" && error.code === 11000) {
    setNoStoreHeaders(res);
    return res.status(409).json({
      message: "Resource already exists",
      details: error.keyValue,
      requestId: req.id,
    });
  }

  const statusCode = error.statusCode || 500;
  const payload = {
    message: error.message || "Internal server error",
    requestId: req.id,
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (statusCode >= 500) {
    logSecurityEvent({
      severity: "error",
      type: "server_error",
      req,
      details: {
        message: error.message,
      },
    });
  }

  setNoStoreHeaders(res);
  return res.status(statusCode).json(payload);
};

module.exports = errorHandler;
