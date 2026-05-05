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

export default api;
