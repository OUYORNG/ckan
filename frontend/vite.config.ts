import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/portal/static/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/portal/api": "http://127.0.0.1:5100",
      "/api": "http://127.0.0.1:5100",
      "/datastore": "http://127.0.0.1:5100",
    },
  },
}));
