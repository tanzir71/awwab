import { defineConfig } from "vite";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArabicText } from "./src/components/ArabicText";
import returnCopy from "./docs/content/return.json";

const base = "/awwab/";

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: { landing: resolve(__dirname, "index.html"), app: resolve(__dirname, "app/index.html") },
    },
  },
  plugins: [{
    name: "awwab-landing-verse",
    transformIndexHtml(html) {
      if (!html.includes("<!-- awwab-welcome-verse -->")) return html;
      const verse = renderToStaticMarkup(createElement(ArabicText, {
        text: returnCopy.welcome.arabic,
        wordLink: position => `${base}app/#/sources?word=${position}`,
      }));
      return html.replace("<!-- awwab-welcome-verse -->", verse);
    },
  }],
});
