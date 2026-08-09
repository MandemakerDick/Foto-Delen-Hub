import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";
import { ogPlugin } from "./vite-og-plugin";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// Build the API origin from the Replit dev domain when available.
// In development and Replit deployments REPLIT_DEV_DOMAIN is always set;
// fall back to an empty string so the ogPlugin skips injection gracefully.
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
const apiBase = replitDevDomain ? `https://${replitDevDomain}` : "";
const fallbackOgImage = apiBase ? `${apiBase}/opengraph.jpg` : "/opengraph.jpg";

// Internal URL for server-to-server API calls from within the Vite middleware.
// Bypasses the external proxy so it works even when the dev domain is unreachable
// from inside the container. Defaults to the standard api-server dev port (8080).
const apiInternal = process.env.API_INTERNAL_BASE ?? "http://localhost:8080";

export default defineConfig({
  base: basePath,
  plugins: [
    ...(apiBase ? [ogPlugin({ apiBase, apiInternal, fallbackImageUrl: fallbackOgImage })] : []),
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "photomatrix-logo.png"],
      manifest: {
        name: "PhotoMatrix",
        short_name: "PhotoMatrix",
        description: "Capture. Connect. Create. Share photos and find photographers with similar interests.",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        scope: basePath,
        start_url: basePath,
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: null,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
