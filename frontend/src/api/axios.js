import axios from "axios";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const isLocalHost = (hostname) => LOCAL_HOSTS.has(hostname);

const buildApiUrlFromCurrentHost = () => {
  if (typeof window === "undefined") {
    return "http://localhost:5000/api";
  }

  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
};

const shouldUseConfiguredApiUrl = (configuredApiUrl) => {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const parsed = new URL(configuredApiUrl, window.location.origin);
    const configuredIsLocal = isLocalHost(parsed.hostname);
    const currentIsLocal = isLocalHost(window.location.hostname);

    // If the app is opened from another device, ignore localhost API targets.
    if (configuredIsLocal && !currentIsLocal) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
};

const resolveApiBaseUrl = () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredApiUrl && shouldUseConfiguredApiUrl(configuredApiUrl)) {
    return configuredApiUrl;
  }

  return buildApiUrlFromCurrentHost();
};

const apiBaseUrl = resolveApiBaseUrl();
const csrfCookieName = import.meta.env.VITE_CSRF_COOKIE_NAME?.trim() || "pulse_csrf";
const csrfHeaderName = import.meta.env.VITE_CSRF_HEADER_NAME?.trim() || "x-csrf-token";
const mutatingMethods = new Set(["post", "put", "patch", "delete"]);

const readCookie = (name) => {
  if (typeof document === "undefined") {
    return "";
  }

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));

  return match ? decodeURIComponent(match[1]) : "";
};

let csrfBootstrapPromise = null;

const ensureCsrfCookie = async () => {
  if (typeof window === "undefined") {
    return "";
  }

  const existingToken = readCookie(csrfCookieName);

  if (existingToken) {
    return existingToken;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/csrf-token`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    })
      .catch(() => null)
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  await csrfBootstrapPromise;
  return readCookie(csrfCookieName);
};

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

let refreshSessionPromise = null;

const authRefreshExcludedPaths = [
  "/auth/login",
  "/auth/refresh",
  "/auth/2fa/verify",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
];

const isAuthRefreshExcluded = (url = "") =>
  authRefreshExcludedPaths.some((path) => String(url).includes(path));

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  config.headers = config.headers || {};

  if (mutatingMethods.has(method)) {
    const csrfToken = await ensureCsrfCookie();

    if (csrfToken) {
      config.headers[csrfHeaderName] = csrfToken;
    }
  }

  const token = window.localStorage.getItem("pulse_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const refreshAccessToken = async () => {
  if (!refreshSessionPromise) {
    refreshSessionPromise = api
      .post("/auth/refresh", {}, { skipAuthRefresh: true })
      .then(({ data }) => {
        if (data?.token) {
          window.localStorage.setItem("pulse_token", data.token);
        }

        if (data?.user) {
          window.localStorage.setItem("pulse_user", JSON.stringify(data.user));
        }

        window.dispatchEvent(
          new CustomEvent("pulse:session-refreshed", { detail: data })
        );

        return data;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !isAuthRefreshExcluded(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        const session = await refreshAccessToken();

        if (session?.token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${session.token}`;
        }

        return api(originalRequest);
      } catch {
        window.localStorage.removeItem("pulse_token");
        window.localStorage.removeItem("pulse_user");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
