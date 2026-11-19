import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";
import { cp, mkdir, rename } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArabicText } from "./src/components/ArabicText";
import returnCopy from "./docs/content/return.json";

const base = "/awwab/";

export default defineConfig(({ mode }) => ({
  base,
  server: { host: "127.0.0.1", port: 8080 },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    copyPublicDir: mode !== "landing",
    rollupOptions: {
      input: { landing: resolve(__dirname, "index.html"), app: resolve(__dirname, mode === "landing" ? "app/preview.html" : "app/index.html") },
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
    {
      name: "awwab-landing-verse",
      transformIndexHtml(html) {
        if (!html.includes("<!-- awwab-welcome-verse -->")) return html;
        const verse = renderToStaticMarkup(createElement(ArabicText, {
          text: returnCopy.welcome.arabic,
          wordLink: position => `${base}app/#/sources?word=${position}`,
        }));
        const withVerse = html.replace("<!-- awwab-welcome-verse -->", verse);
        if (mode !== "landing") return withVerse;
        return withVerse
          .replaceAll(">Open awwab<", ">App preview<")
          .replaceAll(">Install the app<", ">Explore features<")
          .replaceAll('href="#install"', 'href="#features"')
          .replaceAll('app/#/install"', '#features"')
          .replaceAll("How do I install it?", "When can I install it?")
          .replaceAll("Open Awwab in your browser. Look for Install app or Add to Home Screen in the browser menu.", "Installation opens when the app is released.")
          .replace('          <div class="hero-copy">', '          <div class="hero-copy"><p class="pill">Landing milestone · app preview</p>');
      },
    },
    mode === "landing" && {
      name: "awwab-landing-preview",
      apply: "build",
      async writeBundle({ dir }) {
        if (!dir) throw new Error("The landing page needs an output directory.");
        await mkdir(resolve(dir, "app"), { recursive: true });
        await Promise.all([
          rename(resolve(dir, "app/preview.html"), resolve(dir, "app/index.html")),
          cp(resolve(__dirname, "public/landing"), resolve(dir, "landing"), { recursive: true }),
          cp(resolve(__dirname, "public/app/icon-192.png"), resolve(dir, "app/icon-192.png")),
        ]);
      },
    },
    react(),
    mode !== "landing" && VitePWA({
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
}));
