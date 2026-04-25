const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { verifyToken } = require("../utils/jwt");

const authenticate = catchAsync(async (req, _res, next) => {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = authorization.replace("Bearer ", "").trim();
  const decoded = verifyToken(token);
  const user = await User.findById(decoded.sub).select("-password");

  if (!user) {
    throw new ApiError(401, "Invalid session");
  }

  req.user = user;
  next();
});

const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have access to this resource"));
    }

    return next();
  };

const ensureApprovedDoctor = (req, _res, next) => {
  if (req.user?.role !== "doctor") {
    return next();
  }

  if (req.user?.doctorVerification?.status !== "approved") {
    if (!req.user?.doctorVerification?.status) {
      return next();
    }

    return next(
      new ApiError(
        403,
        "Doctor account is pending admin approval. Access is restricted until approved."
      )
    );
  }

  return next();
};

module.exports = {
  authenticate,
  authorize,
  ensureApprovedDoctor,
};
