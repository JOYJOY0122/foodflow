import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const BACKEND_URL = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    // 讓區網內的平板可以連線；proxy 維持同源，不開 CORS。
    host: true,
    proxy: {
      "/api": BACKEND_URL,
      "/health": BACKEND_URL,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
