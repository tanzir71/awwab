import { readFileSync, writeFileSync } from "node:fs";

const tokens = JSON.parse(readFileSync(new URL("../docs/design-tokens.json", import.meta.url), "utf8"));
const shared = Object.entries(tokens.shadow).map(([name, value]) => `  --shadow-${name}: ${value};`);
for (const [name, type] of Object.entries(tokens.type)) {
  shared.push(`  --type-${name}: ${type.weight} ${type.size}px/${type.line}px var(--font-${type.family});`);
  if (type.tracking) shared.push(`  --tracking-${name}: ${Number.parseFloat(type.tracking) / 100}em;`);
}
const modes = tokens.modes.map((mode, index) => {
  const colors = Object.entries(tokens.color).map(([name, value]) => {
    const color = Array.isArray(value) ? value[index] : `var(--c-${value.slice(4)})`;
    return `  --c-${name}: ${color};`;
  });
  const radii = Object.entries(tokens.radius).map(([name, value]) => `  --r-${name}: ${value[index]}px;`);
  const fonts = Object.entries(tokens.font).filter(([, value]) => Array.isArray(value)).map(([name, value]) => {
    const fallback = name === "display" && index === 0 ? "serif" : "sans-serif";
    return `  --font-${name}: "${value[index]} Variable", ${fallback};`;
  });
  return `:root[data-mode="${mode}"], [data-theme-preview="${mode}"] {\n${[...colors, ...radii, ...fonts].join("\n")}\n}`;
});
const css = `/* Generated from docs/design-tokens.json. */\n:root {\n${shared.join("\n")}\n}\n${modes.join("\n")}\n`;
writeFileSync(new URL("../src/theme.css", import.meta.url), css);
