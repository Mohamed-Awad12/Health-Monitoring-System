import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const parseHosts = (value) =>
  (value || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

const allowedHosts = Array.from(
  new Set([
    ...parseHosts(process.env.RAILWAY_PUBLIC_DOMAIN),
    ...parseHosts(process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS),
  ])
);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts,
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    allowedHosts,
  },
});
