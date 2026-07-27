import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend port must match the CLI/server default (7777).
const BACKEND = process.env.AI_DASHBOARD_PORT || "7777";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${BACKEND}`,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
