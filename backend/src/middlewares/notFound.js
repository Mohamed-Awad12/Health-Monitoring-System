const ApiError = require("../utils/ApiError");

const notFound = (_req, _res, next) => {
  next(new ApiError(404, "Route not found"));
};

module.exports = notFound;
