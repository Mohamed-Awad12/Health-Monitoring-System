const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const {
  buildCsrfToken,
  clearCsrfCookie,
  parseCookies,
  setCsrfCookie,
} = require("../utils/cookies");
const { logSecurityEvent } = require("../services/securityEventLogger");
const { setNoStoreHeaders } = require("../utils/httpCache");

const readCsrfTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[env.CSRF_COOKIE_NAME];
  const headerToken =
    req.get(env.CSRF_HEADER_NAME) ||
    req.get(env.CSRF_HEADER_NAME.toUpperCase()) ||
    req.body?.csrfToken;

  return {
    cookieToken,
    headerToken,
  };
};

const issueCsrfToken = (_req, res) => {
  const token = buildCsrfToken();
  setCsrfCookie(res, token);
  return token;
};

const getCsrfToken = (req, res) => {
  const token = issueCsrfToken(req, res);

  setNoStoreHeaders(res);
  res.json({ csrfToken: token });
};

const requireCsrf = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  // Bearer-token requests do not rely on automatically attached browser
  // cookies, so CSRF protection is not required for that auth mode.
  if (req.authSource === "bearer") {
    next();
    return;
  }

  const { cookieToken, headerToken } = readCsrfTokenFromRequest(req);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logSecurityEvent({
      severity: "warning",
      type: "csrf_verification_failed",
      req,
    });
    next(new ApiError(403, "CSRF verification failed"));
    return;
  }

  next();
};

const clearCsrf = (_req, res, next) => {
  clearCsrfCookie(res);
  next();
};

module.exports = {
  getCsrfToken,
  requireCsrf,
  issueCsrfToken,
  clearCsrf,
};
