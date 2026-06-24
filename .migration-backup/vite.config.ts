import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const plugins = [
  react(),
  runtimeErrorOverlay(),
  themePlugin(),
];

if (
  process.env.NODE_ENV !== "production" &&
  process.env.REPL_ID !== undefined
) {
  try {
    const cartographer = require("@replit/vite-plugin-cartographer");
    plugins.push(cartographer.cartographer());
  } catch (e) {
    console.warn("⚠️ Failed to load cartographer (expected in production):", e.message);
  }
}

export default defineConfig({
  plugins,
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      protocol: "wss",
      host: "0.0.0.0",
      clientPort: 443,
    },
  },
});
