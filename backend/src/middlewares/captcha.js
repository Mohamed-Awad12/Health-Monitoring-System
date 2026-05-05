const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const { logSecurityEvent } = require("../services/securityEventLogger");

const providerEndpoints = {
  hcaptcha: "https://hcaptcha.com/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
};

const isCaptchaEnabled = () => Boolean(env.CAPTCHA_PROVIDER && env.CAPTCHA_SECRET);

const verifyCaptchaResponse = async (token, remoteIp) => {
  const endpoint =
    env.CAPTCHA_SITEVERIFY_URL ||
    providerEndpoints[env.CAPTCHA_PROVIDER] ||
    providerEndpoints.hcaptcha;

  const payload = new URLSearchParams({
    secret: env.CAPTCHA_SECRET,
    response: token,
  });

  if (remoteIp) {
    payload.set("remoteip", remoteIp);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!response.ok) {
    throw new ApiError(502, "Captcha verification service is unavailable");
  }

  return response.json();
};

const requireCaptcha = async (req, _res, next) => {
  if (!isCaptchaEnabled()) {
    next();
    return;
  }

  try {
    const token =
      req.body?.captchaToken ||
      req.get("x-captcha-token") ||
      req.query?.captchaToken;

    if (!token) {
      throw new ApiError(400, "Captcha token is required");
    }

    const verification = await verifyCaptchaResponse(token, req.ip);

    if (!verification?.success) {
      logSecurityEvent({
        severity: "warning",
        type: "captcha_verification_failed",
        req,
        details: {
          provider: env.CAPTCHA_PROVIDER,
          errors: verification?.["error-codes"] || [],
        },
      });
      throw new ApiError(403, "Captcha verification failed");
    }

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "captchaToken")) {
      delete req.body.captchaToken;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  isCaptchaEnabled,
  requireCaptcha,
};
