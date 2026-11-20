import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyLandingCopy, banglaDraft, escapeHtml } from "./landing-copy.mjs";
import inventory from "../handovers/H2-languages-paths-arabic-help/data/locales.json" with { type: "json" };

const english = { code: "en", native: "English", dir: "ltr", script: "Latn", path: "index.html", messages: {} };
const sourceTemplate = new URL("../index.html", import.meta.url);
const workerTemplate = new URL("../src/landing-sw.js", import.meta.url);

export function landingPages({ base, publicUrl, mode, published, review }) {
  const preview = mode === "preview" || mode === "development" || mode === "review";
  const locales = [english, ...inventory.locales.flatMap(locale => {
    const { code } = locale;
    const pack = review?.code === code ? review.pack : Object.hasOwn(published, code)
      ? JSON.parse(readFileSync(new URL(`../public/locales/${code}.json`, import.meta.url), "utf8"))
      : undefined;
    if (!pack && !(preview && code === "bn")) return [];
    const asset = review?.code === code ? review.asset : published[code];
    return [{ ...locale, path: `lang/${code}.html`, messages: pack?.messages ?? banglaDraft, fonts: asset?.fonts ?? [] }];
  })];
  const href = locale => locale.code === "en" ? base : base + locale.path;
  const canonical = locale => new URL(locale.code === "en" ? "" : locale.path, publicUrl).href;
  const alternates = [...locales.map(locale =>
    `<link rel="alternate" hreflang="${locale.code}" href="${canonical(locale)}">`),
  `<link rel="alternate" hreflang="x-default" href="${canonical(english)}">`].join("\n    ");

  function render(html, locale) {
    const activeUrl = canonical(locale);
    const options = locales.map(item => `<a href="${href(item)}" data-landing-language="${item.code}" hreflang="${item.code}"${item === locale ? ' aria-current="page"' : ""}>`
      + `<bdi lang="${item.code}" dir="${item.dir}" data-script="${item.script}" data-locale-name="${item.script}">${escapeHtml(item.native)}</bdi></a>`).join("");
    const fontRules = (locale.fonts ?? []).map(font =>
      `@font-face{font-family:"${font.family}";src:url("${base}${font.path}") format("woff2");font-weight:100 900;font-display:swap;unicode-range:${font.unicodeRange}}`,
    ).join("");
    const messages = preview
      ? { ...locale.messages, landingOpenApp: locale.code === "bn" ? "অ্যাপের প্রিভিউ" : locale.messages.landingOpenApp ?? "App preview" }
      : locale.messages;
    const text = applyLandingCopy(html, messages)
      .replace(/<html lang="[^"]+" dir="[^"]+" data-ui-script="[^"]+"/, `<html lang="${locale.code}" dir="${locale.dir}" data-ui-script="${locale.script}"`)
      .replace(/rel="canonical" href="[^"]+"/, `rel="canonical" href="${activeUrl}"`)
      .replace(/property="og:url" content="[^"]+"/, `property="og:url" content="${activeUrl}"`)
      .replace(/<style id="landing-locale-fonts">[^<]*<\/style>/, `<style id="landing-locale-fonts">${fontRules}</style>`)
      .replace(/<!-- awwab-landing-options -->.*?<!-- \/awwab-landing-options -->/, `<!-- awwab-landing-options -->${options}<!-- /awwab-landing-options -->`)
      .replace(/<bdi data-landing-current lang="[^"]+"[^>]*>[^<]*<\/bdi>/, `<bdi data-landing-current lang="${locale.code}" data-locale-name="${locale.script}">${escapeHtml(locale.native)}</bdi>`);
    if (locale.code === "en") return text;
    return text.replace(/href="([^"]*)"/g, (attribute, url) => {
      const app = base + "app/";
      return url === app || url.startsWith(app + "#")
        ? `href="${app}?language=${locale.code}${url.slice(app.length)}"`
        : attribute;
    });
  }

  return {
    name: "awwab-landing-locales",
    transformIndexHtml(html) {
      if (!html.includes("<!-- awwab-landing-alternates -->")) return html;
      return render(html, english)
        .replace("<!-- awwab-landing-alternates -->", (preview ? '<meta name="robots" content="noindex">\n    ' : "") + alternates)
        .replace('<details class="landing-language" hidden>', locales.length > 1 ? '<details class="landing-language">' : '<details class="landing-language" hidden>');
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split("?")[0];
        const locale = locales.find(item => item.code !== "en" && (href(item) === path || "/" + item.path === path));
        if (!locale) return next();
        try {
          const template = readFileSync(sourceTemplate, "utf8").replaceAll('"./src/', '"/src/');
          const html = await server.transformIndexHtml(base, template);
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(render(html.replaceAll("%BASE_URL%", base), locale));
        } catch (error) { next(error); }
      });
    },
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        const index = bundle["index.html"]?.source;
        if (typeof index !== "string") throw new Error("Landing HTML is missing from the build");
        const markup = new Map([[english.path, index]]);
        for (const locale of locales.slice(1)) {
          const source = render(index, locale);
          this.emitFile({ type: "asset", fileName: locale.path, source });
          markup.set(locale.path, source);
        }
        const hash = createHash("sha256");
        const files = new Set(markup.keys());
        for (const source of markup.values()) hash.update(source);
        const references = new RegExp(`${base}((?:assets|landing|design|app|locale-fonts)/[\\w./@-]+\\.(?:js|css|svg|png|webp|woff2))`, "g");
        function collect(source) {
          for (const [, path] of source.matchAll(references)) {
            if (files.has(path)) continue;
            files.add(path);
            const asset = bundle[path];
            const contents = asset?.code ?? asset?.source ?? readFileSync(resolve("public", path));
            hash.update(contents);
            if (path.endsWith(".css")) collect(String(contents));
          }
        }
        for (const source of markup.values()) collect(source);
        const worker = readFileSync(workerTemplate, "utf8");
        this.emitFile({ type: "asset", fileName: "landing-sw.js", source: worker
          .replace("__LANDING_CACHE_VERSION__", JSON.stringify(hash.update(worker).digest("hex").slice(0, 16)))
          .replace("__LANDING_CACHE_FILES__", JSON.stringify([...files])) });
      },
    },
  };
}
