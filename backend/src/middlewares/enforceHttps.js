const env = require("../config/env");

const isSecureRequest = (req) =>
  req.secure || req.headers["x-forwarded-proto"] === "https";

const enforceHttps = (req, res, next) => {
  if (!env.ENFORCE_HTTPS) {
    next();
    return;
  }

  if (isSecureRequest(req)) {
    next();
    return;
  }

  const host = req.headers.host;

  if (!host) {
    next();
    return;
  }

  res.redirect(301, `https://${host}${req.originalUrl}`);
};

module.exports = enforceHttps;
