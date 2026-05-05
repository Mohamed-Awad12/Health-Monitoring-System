const User = require("../models/User");
const { logSecurityEvent } = require("../services/securityEventLogger");
const ApiError = require("../utils/ApiError");
const { parseCookies } = require("../utils/cookies");
const catchAsync = require("../utils/catchAsync");
const env = require("../config/env");
const { verifyToken } = require("../utils/jwt");

const getAccessToken = (req) => {
  const authorization = req.headers.authorization || "";

  if (authorization.startsWith("Bearer ")) {
    return {
      token: authorization.replace("Bearer ", "").trim(),
      source: "bearer",
    };
  }

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[env.AUTH_COOKIE_NAME];

  if (!token) {
    return {
      token: "",
      source: null,
    };
  }

  return {
    token,
    source: "cookie",
  };
};

const authenticate = catchAsync(async (req, _res, next) => {
  const { token, source } = getAccessToken(req);

  if (!token) {
    logSecurityEvent({
      severity: "warning",
      type: "missing_authentication_token",
      req,
    });
    throw new ApiError(401, "Authentication required");
  }

  const decoded = verifyToken(token);
  const user = await User.findById(decoded.sub).select("-password");

  if (!user) {
    logSecurityEvent({
      severity: "warning",
      type: "invalid_session_user_missing",
      req,
      details: { source },
    });
    throw new ApiError(401, "Invalid session");
  }

  if (!user.emailVerified) {
    throw new ApiError(403, "Please verify your email before continuing");
  }

  req.user = user;
  req.authSource = source;
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
  getAccessToken,
};
