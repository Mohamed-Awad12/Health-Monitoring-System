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
    port: 4174,
    allowedHosts,
  },
  preview: {
    host: true,
    port: 4174,
    allowedHosts,
  },
  build: {
    target: "es2020",
    reportCompressedSize: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("three")) {
            return "three-vendor";
          }

          if (id.includes("gsap")) {
            return "motion-vendor";
          }

          if (id.includes("react")) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
