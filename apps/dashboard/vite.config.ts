import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7532,
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:7531",
        ws: true,
      },
      "/api": "http://127.0.0.1:7531",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
