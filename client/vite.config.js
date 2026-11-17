import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const mapboxToken = process.env.VITE_MAPBOX_PUBLIC_TOKEN ?? env.VITE_MAPBOX_PUBLIC_TOKEN ?? "";
  if (mapboxToken && !mapboxToken.startsWith("pk.")) {
    throw new Error("VITE_MAPBOX_PUBLIC_TOKEN must be a public pk.* token. Never expose an sk.* secret in the frontend build.");
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": "http://localhost:4000" }
    }
  };
});
