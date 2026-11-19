import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArabicText } from "./src/components/ArabicText";
import { wordAnatomy } from "./src/lib/wordAnatomy";
import returnCopy from "./docs/content/return.json";
import anatomySample from "./docs/content/word-anatomy.sample.json";
import onboarding from "./docs/content/onboarding.json";
import spoken from "./docs/content/spoken-arabic.json";
import { tajweedPrecache } from "./src/lib/tajweed";

const base = "/awwab/";

export default defineConfig(({ mode }) => ({
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
    {
      name: "awwab-html",
      transformIndexHtml(html) {
        if (html.includes("<!-- awwab-preview-meta -->")) {
          return html.replace("<!-- awwab-preview-meta -->", mode === "preview" ? '<meta name="robots" content="noindex">' : "")
            .replace("<title>awwab</title>", mode === "preview" ? "<title>awwab preview</title>" : "<title>awwab</title>");
        }
        if (!html.includes("<!-- awwab-welcome-verse -->")) return html;
        const verse = renderToStaticMarkup(createElement(ArabicText, {
          text: returnCopy.welcome.arabic,
          wordLink: position => `${base}app/#/sources?word=${position}`,
        }));
        const wordLink = () => `${base}app/#/learn/surahs/103?anatomy=103:1:1`;
        const tiles = wordAnatomy(anatomySample.word).letters.map(tile => renderToStaticMarkup(createElement("div", {
          className: "landing-letter-tile", "data-silent": tile.silent, style: { "--mark-color": `var(--c-${tile.color})` },
        }, createElement(ArabicText, { text: tile.glyph, compact: true, wordLink }),
        createElement("small", { dir: "ltr" }, tile.name), createElement("small", { dir: "ltr" }, tile.mark))));
        const asrWord = renderToStaticMarkup(createElement(ArabicText, { text: anatomySample.word, compact: true, wordLink }));
        const content = html.replace("<!-- awwab-welcome-verse -->", verse)
          .replace("<!-- awwab-letter-tiles -->", tiles.join("")).replace("<!-- awwab-asr-word -->", asrWord);
        return mode === "preview" ? content.replaceAll(">Open awwab<", ">App preview<") : content;
      },
    },
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
        globPatterns: [
          "app/**/*.{html,webmanifest,png,svg,otf,woff2,mjs}", "assets/**/*", "design/**/*", "data/**/*", "packs/audio/index.json",
          ...Object.values(onboarding.samples).map(item => item.path),
          "packs/study-speech/*.opus",
          ...spoken.units.flatMap(unit => unit.id === "sim" ? [] : unit.phrases.map(id => `packs/phrases/saudi/female/${id}.opus`)),
          ...tajweedPrecache,
        ],
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
