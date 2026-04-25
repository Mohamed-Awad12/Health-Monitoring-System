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

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("pulse_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
