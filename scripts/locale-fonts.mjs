import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import families from "./locale-fonts.json" with { type: "json" };

const packages = fileURLToPath(new URL("../node_modules/@fontsource-variable/", import.meta.url));
const files = new Map();
const notices = "app/locale-font-notices.txt";
const nastaliqPackage = "noto-nastaliq-urdu";

function fontAssets(name, subsets, family, weight) {
  const ranges = JSON.parse(readFileSync(resolve(packages, name, "unicode.json"), "utf8"));
  return subsets.map(subset => {
    const filename = `${name}-${subset}-wght-normal.woff2`;
    const contents = readFileSync(resolve(packages, name, "files", filename));
    const digest = createHash("sha256").update(contents).digest("hex");
    const path = `locale-fonts/${filename.replace(".woff2", `-${digest.slice(0, 12)}.woff2`)}`;
    files.set(path, contents);
    return {
      path, family, weight, unicodeRange: ranges[subset], bytes: contents.length,
      digest,
    };
  });
}

export function localeFonts(script) {
  const source = families[script];
  return source ? fontAssets(source.package, source.subsets, `Awwab UI ${script}`, "100 900") : [];
}

export function localeReadingFont(code) {
  if (code === "ur") return fontAssets(nastaliqPackage, ["arabic"], "Noto Nastaliq Urdu Variable", "400 700")[0];
}

export function localeFontFiles(base, published) {
  const paths = new Set(Object.values(published).flatMap(pack => pack.fonts?.map(font => font.path) ?? []));
  for (const pack of Object.values(published)) {
    if (pack.readingFont) paths.add(pack.readingFont.path);
  }
  const packageNames = new Set(["noto-serif", "noto-sans-arabic", "noto-sans-bengali", "noto-serif-bengali", "baloo-2", "nunito", nastaliqPackage,
    ...Object.values(families).map(family => family.package)]);
  const license = [...packageNames].map(name =>
    `${name}\n${readFileSync(resolve(packages, name, "LICENSE"), "utf8").trimEnd()}`,
  ).join("\n\n");
  return {
    name: "awwab-locale-fonts",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split("?", 1)[0];
        const path = url?.startsWith(base) ? url.slice(base.length) : url?.slice(1);
        if (path === notices) {
          response.setHeader("Content-Type", "text/plain; charset=utf-8");
          return response.end(license);
        }
        if (!paths.has(path)) return next();
        response.setHeader("Content-Type", "font/woff2");
        response.end(files.get(path));
      });
    },
    generateBundle() {
      for (const path of paths) this.emitFile({ type: "asset", fileName: path, source: files.get(path) });
      this.emitFile({ type: "asset", fileName: notices, source: license + "\n" });
    },
  };
}
