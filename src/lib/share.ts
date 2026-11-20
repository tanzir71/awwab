import { SHARE_URL, asset } from "./config";
import { languages, type AppLanguage } from "./languagePreferences";
import banglaFontUrl from "@fontsource-variable/noto-sans-bengali/files/noto-sans-bengali-bengali-wght-normal.woff2?url";
import banglaDisplayUrl from "@fontsource-variable/noto-serif-bengali/files/noto-serif-bengali-bengali-wght-normal.woff2?url";

export const shareTemplates = [
  { id: "surah", label: "shareSurah", theme: "dark" },
  { id: "words", label: "shareWords", theme: "dark" },
  { id: "return", label: "shareReturn", theme: "dark" },
  { id: "qaida", label: "shareQaida", theme: "light" },
  { id: "umrah", label: "shareUmrah", theme: "dark" },
  { id: "maktab", label: "shareMaktab", theme: "dark" },
] as const;

export type TemplateId = typeof shareTemplates[number]["id"];
export const shareFormats = {
  story: { label: "shareStory", width: 1080, height: 1920, scale: 3 },
  post: { label: "sharePost", width: 1080, height: 1350, scale: 3 },
  wide: { label: "shareWide", width: 1200, height: 630, scale: 2 },
};
export type ShareFormat = keyof typeof shareFormats;

export interface ShareTile {
  arabic: string;
  label?: string;
  mark?: string;
  ink?: string;
  dot?: string;
  sound?: string;
}

export interface ShareCard {
  badge: string;
  title: string;
  detail: string;
  arabic?: string;
  meaning?: string;
  citation?: string;
  reference?: string;
  note?: string;
  progress?: { value: number; total: number; label: string };
  tiles?: ShareTile[];
  activity?: number[];
  numbers?: { title: string; label: string };
  tagline: string;
}

export interface ShareModel {
  template: TemplateId | "hadith";
  language: AppLanguage;
  format: ShareFormat;
  light: boolean;
  showPrayerNumbers: boolean;
  card: ShareCard;
}

export const shareUrl = (id: TemplateId) => SHARE_URL + "?ref=share-" + id;
export const shareFooterLink = SHARE_URL.replace(/^https:\/\//, "").replace(/\/$/, "");
const arabicFont = '"Noto Sans Arabic Variable"';
const wordmarkFont = '"Noto Sans Variable"';
const banglaFont = '"Noto Sans Bengali Variable"';
const banglaDisplay = '"Noto Serif Bengali Variable"';
const arabic = /\p{Script=Arabic}/u;
const bangla = /\p{Script=Bengali}/u;
const rtlScript = /[\p{Script=Arabic}\p{Script=Thaana}]/u;
const images = new Map<string, Promise<HTMLImageElement>>();
const bengaliFonts = new Map<string, Promise<string>>();

function cachedAsset(url: string) {
  return globalThis.caches?.match(new URL(url, location.href).href, { ignoreSearch: true }).catch(() => undefined);
}

function loadBengaliFont(family: string, url: string, sample: string) {
  const existing = bengaliFonts.get(family);
  if (existing) return existing;
  const loading = document.fonts.load(`600 42px ${family}`, sample).then(() => family).catch(async error => {
    // WebKit can fail a CSS font request offline even when the font is in CacheStorage.
    const response = await cachedAsset(url);
    if (!response) throw error;
    const name = family.slice(1, -1) + " Offline";
    const face = await new FontFace(name, await response.arrayBuffer(), { weight: "100 900" }).load();
    document.fonts.add(face);
    return `"${name}"`;
  }).catch(error => {
    bengaliFonts.delete(family);
    throw error;
  });
  bengaliFonts.set(family, loading);
  return loading;
}

function loadArtwork(name: string) {
  const existing = images.get(name);
  if (existing) return existing;
  const image = new Image();
  const url = asset("design/" + name + ".svg");
  image.src = url;
  const decoded = image.decode().catch(async error => {
    const response = await cachedAsset(url);
    if (!response) throw error;
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      image.src = objectUrl;
      await image.decode();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }).then(() => image).catch(error => {
    images.delete(name);
    throw error;
  });
  images.set(name, decoded);
  return decoded;
}

function palette(light: boolean, maktab: boolean) {
  const theme = document.createElement("span");
  theme.hidden = true;
  theme.dataset.themePreview = maktab ? "maktab" : "adult";
  document.body.append(theme);
  const style = getComputedStyle(theme);
  const color = (name: string) => style.getPropertyValue("--c-" + name).trim();
  const result = {
    ground: color(light ? "bg" : "night"),
    ink: color(light ? "ink" : "on-night"),
    muted: color(light ? "ink-muted" : "night-muted"),
    panel: color(light ? "surface" : "overlay-on-night"),
    track: color(light ? "surface-alt" : "overlay-on-night"),
    badge: color(light ? "primary-soft" : "overlay-on-night"),
    accent: color(light ? "primary" : "on-night"),
    display: style.getPropertyValue("--font-display").trim(),
    body: style.getPropertyValue("--font-body").trim(),
    marks: {
      fatha: color("harakat-fatha"),
      kasra: color("harakat-kasra"),
      damma: color("harakat-damma"),
    },
  };
  theme.remove();
  return result;
}

type Palette = ReturnType<typeof palette>;

type Ink = "ink" | "muted" | "accent";
type Face = "display" | "body" | "arabic" | "wordmark";
type Align = "left" | "center" | "right";
type TextOptions = {
  width?: number; line?: number; face?: Face; align?: Align; color?: Ink; fill?: string;
  maxLines?: number; letterSpacing?: string; fit?: boolean;
};

function painter(ctx: CanvasRenderingContext2D, colors: Palette, language: AppLanguage, bengali: { body: string; display: string }) {
  const direction = languages.find(item => item.code === language)?.dir === "rtl" ? "rtl" : "ltr";
  const caps = (value: string) => value.toLocaleUpperCase(language);
  function tile(x: number, y: number, w: number, h: number, radius: number, fill = colors.panel) {
    if (w <= 0 || h <= 0) return;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function type(value: string, size: number, weight: number, face: Face, spacing: string) {
    const arabicText = face === "arabic" || arabic.test(value);
    const banglaText = bangla.test(value);
    const family = face === "wordmark" ? wordmarkFont
      : face === "arabic" ? arabicFont
        : arabicText ? `${arabicFont}, ${colors[face]}`
          : banglaText ? `${bengali[face]}, ${colors[face]}` : colors[face];
    const letter = value.match(/\p{L}/u)?.[0];
    ctx.font = `${weight} ${size}px ${family}`;
    const rtl = letter ? rtlScript.test(letter) : direction === "rtl" && !/\p{Nd}/u.test(value);
    ctx.direction = face === "arabic" || rtl ? "rtl" : "ltr";
    if ("letterSpacing" in ctx) ctx.letterSpacing = rtlScript.test(value) || banglaText ? "0px" : spacing;
  }

  function wrap(value: string, width: number) {
    const lines: string[] = [];
    for (const paragraph of value.split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        const joined = current ? current + " " + word : word;
        if (current && ctx.measureText(joined).width > width) {
          lines.push(current);
          current = word;
        } else current = joined;
      }
      lines.push(current);
    }
    return lines;
  }

  function text(value: string, size: number, weight: number, options: TextOptions) {
    const { width = 302, line = size * 1.2, face = "body", align = "center", color = "ink", fill = colors[color],
      maxLines = 5, letterSpacing = "0px", fit = false } = options;
    let fontSize = size;
    type(value, fontSize, weight, face, letterSpacing);
    let lines = maxLines === 1 ? [value.replace(/\s*\n\s*/g, " ")] : wrap(value, width);
    while (fit && lines.length > maxLines && fontSize > size * .75) {
      fontSize -= .5;
      type(value, fontSize, weight, face, letterSpacing);
      lines = wrap(value, width);
    }
    const visible = lines.slice(0, maxLines);
    return {
      height: visible.length * line,
      draw(x: number, top: number) {
        type(value, fontSize, weight, face, letterSpacing);
        ctx.textBaseline = face === "arabic" ? "alphabetic" : "top";
        ctx.textAlign = align;
        ctx.fillStyle = fill;
        for (const [index, content] of visible.entries()) {
          const ascent = face === "arabic" ? ctx.measureText(content).actualBoundingBoxAscent : 0;
          ctx.fillText(content, x, top + index * line + ascent, width);
        }
      },
    };
  }

  function write(value: string, x: number, top: number, size: number, weight: number, options: TextOptions = {}) {
    if (!value) return top;
    const layout = text(value, size, weight, options);
    layout.draw(x, top);
    return top + layout.height;
  }
  function badge(label: string, x: number, y: number, align: Align = "center") {
    const content = caps(label);
    const weight = bangla.test(content) ? 600 : 700;
    type(content, 10, weight, "body", ".55px");
    const w = Math.min(304, Math.ceil(ctx.measureText(content).width) + 24);
    tile(align === "center" ? x - w / 2 : x, y, w, 24, 12, colors.badge);
    write(content, align === "left" ? x + 12 : x, y + 5, 10, weight,
      { align, color: "accent", width: w - 24, letterSpacing: ".55px", maxLines: 1 });
  }
  function countBar(progress: ShareCard["progress"], y: number, segments = false) {
    if (!progress) return;
    if (segments) {
      const step = 23;
      const left = (360 - (progress.total * step - 5)) / 2;
      for (let i = 0; i < progress.total; i++) tile(left + i * step, y, 18, 6, 3, i < progress.value ? colors.accent : colors.track);
    } else {
      tile(60, y, 240, 8, 4, colors.track);
      tile(60, y, 240 * progress.value / progress.total, 8, 4, colors.accent);
    }
    write(progress.label, 180, y + 20, 13, 500, { color: "muted", line: 17, maxLines: segments ? 1 : 2, fit: true });
  }
  function grid(tiles: ShareTile[], x: number, y: number, width: number, columns: number, height: number, step: number, rtl = false) {
    const gap = columns === 7 ? 6 : 8;
    const w = (width - (columns - 1) * gap) / columns;
    tiles.forEach((item, index) => {
      const col = index % columns;
      const left = x + (rtl ? columns - 1 - col : col) * (w + gap);
      const top = y + Math.floor(index / columns) * step;
      tile(left, top, w, height, columns === 7 ? 8 : 12);
      write(item.arabic, left + w / 2, top + (item.label ? 5 : 1), columns === 7 ? 25 : 27, 500, { face: "arabic", width: w - 5, maxLines: 1 });
      if (item.label) write(caps(item.label), left + w / 2, top + (height > 62 ? 46 : 40), 9, 700,
        { color: "muted", width: w - 7, letterSpacing: ".6px", maxLines: 1 });
    });
  }
  return { badge, caps, countBar, grid, text, tile, write };
}

type Painter = ReturnType<typeof painter>;

function drawSurah(paint: Painter, card: ShareCard, compact: boolean) {
  const { badge, write, text, tile, countBar } = paint;
  badge(card.badge, 180, 36);
  write(card.arabic, 180, compact ? 72 : 110, compact ? 60 : 72, compact ? 500 : 400, { face: "arabic", maxLines: 1 });
  const titleEnd = write(card.title, 180, compact ? 166 : 231, 34, 600, { face: "display", line: 40, maxLines: 1 });
  const detailEnd = write(card.detail, 180, titleEnd + 14, 13, 500, { color: "muted", line: 18, maxLines: 2, fit: true });
  let progressTop = compact ? Math.max(244, detailEnd + 12) : 495;
  if (!compact && card.meaning) {
    const top = Math.max(321, detailEnd + 10);
    const quote = text("“" + card.meaning + "”", 15, 400, { width: 268, line: 22, maxLines: 5, fit: true });
    const panelHeight = Math.max(140, quote.height + 52);
    tile(28, top, 304, panelHeight, 16);
    quote.draw(180, top + 16);
    write(card.citation, 180, top + panelHeight - 27, 9, 700, { width: 268, color: "muted", letterSpacing: ".6px", maxLines: 1 });
    progressTop = Math.min(517, Math.max(progressTop, top + panelHeight + 34));
  }
  countBar(card.progress, progressTop, true);
  if (compact) write(card.reference, 180, progressTop + 43, 11, 500, { color: "muted", maxLines: 1 });
}

function drawWords(paint: Painter, card: ShareCard, wide: boolean) {
  const { badge, write, grid } = paint;
  if (wide) {
    badge(card.badge, 32, 28, "left");
    write(card.title, 32, 57, 80, 600, { face: "display", align: "left", width: 260, maxLines: 1 });
    write(card.detail, 32, 147, 16, 600, { align: "left", width: 260, line: 22, maxLines: 3 });
    grid(card.tiles.slice(0, 6), 318, 48, 250, 3, 58, 64);
    return;
  }
  badge(card.badge, 180, 36);
  write(card.title, 180, 66, 110, 600, { face: "display", maxLines: 1 });
  write(card.detail, 180, 205, 18, 600, { line: 24, maxLines: 3 });
  grid(card.tiles, 28, 284, 304, 3, 68, 76);
  write(card.note, 180, 519, 13, 500, { color: "muted", line: 18, maxLines: 3 });
}

function drawReturning(paint: Painter, card: ShareCard, colors: Palette, numbers: boolean) {
  const { badge, write, tile } = paint;
  badge(card.badge, 180, 36);
  write(numbers ? card.numbers?.title : card.title, 180, 94, 39, 600, { line: 46, face: "display", maxLines: 3 });
  write(card.detail, 180, 205, 15, 400, { color: "muted", maxLines: 2 });
  const step = 256 / 53;
  card.activity?.forEach((count, index) => {
    const x = 52 + Math.floor(index / 7) * step;
    const y = 258 + (index % 7) * 10;
    tile(x, y, step - 1.1, 7, 1, count ? colors.accent : colors.track);
  });
  write(card.note, 180, 331, 12, 500, { color: "muted", line: 17, maxLines: 2 });
  if (numbers) write(card.numbers?.label, 180, 369, 12, 600, { color: "muted", maxLines: 1 });
  tile(28, 409, 304, 106, 16);
  write(card.arabic, 180, 429, 23, 500, { face: "arabic", width: 278, maxLines: 1 });
  write("“" + card.meaning + "” · " + card.citation, 180, 465, 13, 500, { color: "muted", width: 270, line: 18, maxLines: 3 });
}

function drawQaida(paint: Painter, card: ShareCard, colors: Palette, marks: Record<string, HTMLImageElement>, ctx: CanvasRenderingContext2D) {
  const { badge, write, tile, countBar } = paint;
  badge(card.badge, 180, 36);
  const titleEnd = write(card.title, 180, 96, 30, 600, { face: "display", line: 34, maxLines: 2 });
  const detailEnd = write(card.detail, 180, titleEnd + 14, 15, 400, { color: "muted", line: 22, maxLines: 3 });
  const y = Math.max(226, detailEnd + 4);
  card.tiles.forEach((item, index) => {
    const left = 28 + (2 - index) * 105;
    tile(left, y, 94, 118, 12);
    const ink = item.ink ? colors.marks[item.ink] : colors.accent;
    write(item.arabic, left + 47, y + 12, 36, 500, { face: "arabic", fill: ink, maxLines: 1 });
    write(item.label, left + 47, y + 54, 11, 700, { maxLines: 1 });
    const dot = marks[item.dot];
    if (dot) ctx.drawImage(dot, left + 24, y + 77);
    write(item.mark, left + 51, y + 73, 9, 700, { fill: ink, maxLines: 1 });
    write(item.sound, left + 47, y + 92, 15, 700, { color: "accent", maxLines: 1 });
  });
  tile(28, y + 132, 304, 98, 16, colors.panel);
  card.tiles.forEach((item, i) => write(item.label + " + " + item.mark + " = " + item.sound, 180, y + 146 + i * 26, 14, 600, { maxLines: 1 }));
  countBar(card.progress, y + 244);
}

function drawUmrah(paint: Painter, card: ShareCard) {
  const { badge, write, tile } = paint;
  badge(card.badge, 180, 36);
  const titleEnd = write(card.title, 180, 101, 42, 600, { face: "display", line: 46, maxLines: 2 });
  const arabicTop = Math.max(173, titleEnd + 12);
  write(card.arabic, 180, arabicTop, 34, 500, { face: "arabic", maxLines: 1 });
  write("“" + card.meaning + "”", 180, arabicTop + 75, 15, 400, { color: "muted", maxLines: 2 });
  const top = arabicTop + 141;
  tile(28, top, 304, 110, 16);
  write(card.detail, 180, top + 16, 17, 600, { maxLines: 2 });
  write(card.note, 180, top + 48, 13, 500, { color: "muted", width: 270, line: 17, maxLines: 2 });
  write(card.citation, 180, top + 87, 9, 600, { color: "muted", maxLines: 1 });
}

function drawMaktab(paint: Painter, card: ShareCard) {
  const { badge, write, grid } = paint;
  badge(card.badge, 180, 36);
  const titleEnd = write(card.title, 180, 75, 38, 600, { face: "display", line: 42, maxLines: 3 });
  const y = Math.max(172, titleEnd + 10);
  grid(card.tiles, 28, y, 304, 7, 39, 45, true);
  write(card.detail, 180, y + 188, 15, 400, { color: "muted", maxLines: 3 });
}

function drawHadith({ badge, write, tile }: Painter, card: ShareCard, width: number) {
  const center = width / 2;
  badge(card.badge, center, 26);
  const titleBottom = write(card.title, center, 67, 26, 600, { face: "display", width: width - 58, line: 32, maxLines: 2 });
  tile(28, titleBottom + 12, width - 56, 190, 16);
  const top = titleBottom + 32;
  const body = card.arabic ? write(card.arabic, center, top, 18, 500, { width: width - 72, face: "arabic", line: 26, maxLines: 3 }) + 8 : top;
  write(card.detail, center, body, 13, 500, { width: width - 88, line: 17, maxLines: card.arabic ? 5 : 8 });
  write(card.citation, center, titleBottom + 215, 12, 600, { width: width - 56, line: 16, maxLines: 2 });
  write(card.note, center, titleBottom + 249, 11, 500, { color: "muted", width: width - 56, line: 14, maxLines: 2 });
}

export async function drawShare(canvas: HTMLCanvasElement, model: ShareModel) {
  const { card, template, format, light, language } = model;
  const maktab = template === "maktab";
  const colors = palette(light, maktab);
  const { width, height, scale } = shareFormats[format];
  const w = width / scale;
  const h = height / scale;
  const motifName = format !== "story" ? "share-compact-motif" : maktab ? "share-maktab-motif" :
    template === "qaida" ? "share-qaida-motif" : template === "return" || template === "umrah" ? "share-return-motif" : "share-story-motif";
  const dotNames = template === "qaida" ? ["share-zabar-dot", "share-zer-dot", "share-pesh-dot"] : [];
  const sample = [card.badge, card.title, card.detail, card.meaning, card.citation, card.note, card.tagline,
    card.progress?.label, card.numbers?.title, card.numbers?.label, ...(card.tiles ?? []).map(tile => tile.label)].filter(Boolean).join(" ");
  const usesBangla = bangla.test(sample);
  const [motif, fatha, dots, bengaliBody, bengaliDisplay] = await Promise.all([
    loadArtwork(motifName),
    loadArtwork(maktab ? "share-maktab-fatha" : "share-fatha"),
    Promise.all(dotNames.map(async name => [name, await loadArtwork(name)] as const)),
    usesBangla ? loadBengaliFont(banglaFont, banglaFontUrl, sample) : banglaFont,
    usesBangla ? loadBengaliFont(banglaDisplay, banglaDisplayUrl, sample) : banglaDisplay,
    document.fonts.load("600 76px " + arabicFont, card.arabic || sample + " ب"),
    document.fonts.load("600 42px " + colors.display, card.title),
    document.fonts.load("600 18px " + colors.body, card.detail),
    document.fonts.load("650 26px " + wordmarkFont),
  ]);
  await document.fonts.ready;
  canvas.width = width;
  canvas.height = height;
  canvas.lang = language;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 0, w, h);

  const motifPosition = format === "wide" ? [420, 120] : format === "post" ? [200, -100] : {
    surah: [170, -120], words: [-150, 380], return: [190, 420], qaida: [-140, 430], umrah: [190, 430], maktab: [200, -120], hadith: [170, -120],
  }[template];
  ctx.drawImage(motif, ...motifPosition as [number, number]);

  const paint = painter(ctx, colors, language, { body: bengaliBody, display: bengaliDisplay });
  const margin = format === "wide" ? 32 : 28;
  const footerTop = h - (format === "wide" ? 64 : 68);
  const tagline = paint.text(paint.caps(card.tagline), 10, bangla.test(card.tagline) ? 500 : 700,
    { align: "right", width: 216, color: "muted", letterSpacing: ".5px", line: 14, maxLines: 2, fit: true });
  const taglineTop = footerTop + 16 - tagline.height;
  ctx.save();
  if (format === "post" && template !== "surah" && template !== "hadith") {
    ctx.translate(57.6, 6);
    ctx.scale(.68, .68);
  } else if (format === "wide" && template !== "words") {
    const scale = tagline.height > 14 ? Math.min(.45, (taglineTop - 14) / 560) : .45;
    ctx.translate(443 - 180 * scale, 2);
    ctx.scale(scale, scale);
  }
  switch (template) {
    case "surah": drawSurah(paint, card, format === "post"); break;
    case "words": drawWords(paint, card, format === "wide"); break;
    case "return": drawReturning(paint, card, colors, model.showPrayerNumbers); break;
    case "qaida": drawQaida(paint, card, colors, Object.fromEntries(dots), ctx); break;
    case "umrah": drawUmrah(paint, card); break;
    case "maktab": drawMaktab(paint, card); break;
    case "hadith": drawHadith(paint, card, w); break;
  }
  ctx.restore();

  if (format === "wide" && template !== "words") {
    paint.badge(card.badge, margin, 28, "left");
    const end = paint.write(card.title, margin, 66, 36, 600, { face: "display", align: "left", width: 266, line: 40, maxLines: 3 });
    paint.write(card.detail, margin, end + 12, 14, 500, { align: "left", width: 266, color: "muted", line: 18, maxLines: 3 });
  }
  paint.write("awwab", margin, footerTop + 12, 26, 650, { face: "wordmark", align: "left", width: 120, maxLines: 1 });
  ctx.drawImage(fatha, margin + 2.94, footerTop + 12);
  tagline.draw(w - margin, taglineTop);
  paint.write(shareFooterLink, w - margin, footerTop + 20, 13, 600, { align: "right", width: 218, maxLines: 1 });
}

export function imageFile(canvas: HTMLCanvasElement, id: ShareModel["template"]) {
  return new Promise<File>((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(new File([blob], "awwab-" + id + ".png", { type: "image/png" }));
    else reject(new Error("Image could not be rendered."));
  }, "image/png"));
}
