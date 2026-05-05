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
  base: process.env.VITE_CDN_BASE_URL?.trim() || "/",
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
  build: {
    manifest: true,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("framer-motion") || id.includes("gsap") || id.includes("animejs")) {
            return "motion";
          }

          if (id.includes("socket.io-client")) {
            return "socket";
          }

          return undefined;
        },
      },
    },
  },
});
