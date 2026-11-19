import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

const base = "/awwab/";

export default defineConfig({
  base,
  server: { host: "127.0.0.1", port: 8080 },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    rollupOptions: {
      input: { landing: resolve(__dirname, "index.html"), app: resolve(__dirname, "app/index.html") },
      output: {
        assetFileNames: ({ name }) => name?.startsWith("maplibre-gl-worker")
          ? "app/workers/[name]-[hash][extname]"
          : "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react";
          if (/\/node_modules\/(dexie|dexie-react-hooks|zod)\//.test(id)) return "storage";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      filename: "app/sw.js",
      scope: `${base}app/`,
      manifest: false,
      injectRegister: false,
      registerType: "autoUpdate",
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["app/**/*.{html,webmanifest,png,svg,otf,woff2,mjs}", "assets/**/*", "design/**/*", "data/**/*", "packs/audio/index.json"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        modifyURLPrefix: { "": base },
        navigateFallback: `${base}app/index.html`,
        navigateFallbackAllowlist: [/^\/awwab\/app\//],
        runtimeCaching: [{
          urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/awwab/packs/"),
          handler: "CacheFirst",
          options: { cacheName: "awwab-packs-v1" },
        }],
      },
    }),
  ],
});
