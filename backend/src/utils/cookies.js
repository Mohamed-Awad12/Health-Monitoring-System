const crypto = require("crypto");
const env = require("../config/env");

const parseCookies = (cookieHeader = "") =>
  String(cookieHeader)
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return cookies;
      }

      const name = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      if (!name) {
        return cookies;
      }

      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});

const buildCookieOptions = () => ({
  secure: env.AUTH_COOKIE_SECURE,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  domain: env.AUTH_COOKIE_DOMAIN || undefined,
  path: "/",
});

const setAuthCookie = (res, token) => {
  res.cookie(env.AUTH_COOKIE_NAME, token, {
    ...buildCookieOptions(),
    httpOnly: true,
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, buildCookieOptions());
};

const REFRESH_COOKIE_NAME = "pulse_refresh";

const setRefreshCookie = (res, token, maxAge) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...buildCookieOptions(),
    httpOnly: true,
    maxAge,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, buildCookieOptions());
};

const buildCsrfToken = () => crypto.randomBytes(32).toString("base64url");

const setCsrfCookie = (res, token) => {
  res.cookie(env.CSRF_COOKIE_NAME, token, {
    ...buildCookieOptions(),
    httpOnly: false,
  });
};

const clearCsrfCookie = (res) => {
  res.clearCookie(env.CSRF_COOKIE_NAME, buildCookieOptions());
};

module.exports = {
  REFRESH_COOKIE_NAME,
  parseCookies,
  setAuthCookie,
  clearAuthCookie,
  setRefreshCookie,
  clearRefreshCookie,
  buildCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
};
