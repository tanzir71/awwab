import { SHARE_URL, asset } from "./config";

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
  note?: string;
  progress?: { value: number; total: number; label: string };
  tiles?: ShareTile[];
  activity?: number[];
  numbers?: { title: string; label: string };
}

export interface ShareModel {
  template: TemplateId;
  format: ShareFormat;
  light: boolean;
  showPrayerNumbers: boolean;
  card: ShareCard;
}

export const shareUrl = (id: TemplateId) => SHARE_URL + "?ref=share-" + id;
const footerLink = SHARE_URL.replace(/^https:\/\//, "").replace(/\/$/, "");
const arabicFont = '"Noto Sans Arabic Variable"';
const shareSans = '"Awwab Share Sans"';
const shareSerif = '"Awwab Share Serif"';
const banglaFont = '"Noto Sans Bengali Variable"';
const bangla = /\p{Script=Bengali}/u;
const images = new Map<string, Promise<HTMLImageElement>>();

function loadArtwork(name: string) {
  const existing = images.get(name);
  if (existing) return existing;
  const image = new Image();
  image.src = asset("design/" + name + ".svg");
  const decoded = image.decode().then(() => image, error => {
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
    display: maktab ? style.getPropertyValue("--font-display").trim() : shareSerif + ", serif",
    body: maktab ? style.getPropertyValue("--font-body").trim() : shareSans + ", sans-serif",
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

function painter(ctx: CanvasRenderingContext2D, colors: Palette) {
  function tile(x: number, y: number, w: number, h: number, radius: number, fill = colors.panel) {
    if (w <= 0 || h <= 0) return;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function font(value: string, size: number, weight: number, face: Face) {
    const family = face === "arabic" ? arabicFont : face === "wordmark" ? shareSans : bangla.test(value) ? banglaFont : colors[face];
    ctx.font = weight + " " + size + "px " + family;
  }
  function write(value: string, x: number, top: number, size: number, weight: number, options: {
    width?: number; line?: number; face?: Face; align?: Align; color?: Ink; fill?: string; maxLines?: number; letterSpacing?: string;
  } = {}) {
    if (!value) return top;
    const { width = 302, line = size * 1.2, face = "body", align = "center", color = "ink", fill = colors[color], maxLines = 5, letterSpacing = "0px" } = options;
    font(value, size, weight, face);
    ctx.textBaseline = face === "arabic" ? "alphabetic" : "top";
    ctx.textAlign = align;
    ctx.direction = face === "arabic" ? "rtl" : "ltr";
    if ("letterSpacing" in ctx) ctx.letterSpacing = letterSpacing;
    ctx.fillStyle = fill;
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
    for (const [index, text] of lines.slice(0, maxLines).entries()) {
      const ascent = face === "arabic" ? ctx.measureText(text).actualBoundingBoxAscent : 0;
      ctx.fillText(text, x, top + index * line + ascent, width);
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    return top + Math.min(lines.length, maxLines) * line;
  }
  function badge(label: string, x: number, y: number, align: Align = "center") {
    font(label, 10, 700, "body");
    const text = label.toLocaleUpperCase();
    const w = Math.ceil(ctx.measureText(text).width + text.length * .55) + 24;
    tile(align === "center" ? x - w / 2 : x, y, w, 24, 12, colors.badge);
    write(text, align === "left" ? x + 12 : x, y + 5, 10, 700, { align, color: "accent", letterSpacing: ".55px", maxLines: 1 });
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
    write(progress.label, 180, y + 20, 13, 500, { color: "muted" });
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
      if (item.label) write(item.label.toLocaleUpperCase(), left + w / 2, top + (height > 62 ? 46 : 40), 9, 700, { color: "muted", width: w - 7, letterSpacing: ".6px", maxLines: 1 });
    });
  }
  return { badge, countBar, grid, tile, write };
}

type Painter = ReturnType<typeof painter>;

function drawSurah(paint: Painter, card: ShareCard, compact: boolean) {
  const { badge, write, tile, countBar } = paint;
  badge(card.badge, 180, 36);
  write(card.arabic, 180, compact ? 72 : 110, compact ? 60 : 70, 500, { face: "arabic", maxLines: 1 });
  const titleEnd = write(card.title, 180, compact ? 166 : 231, 34, 600, { face: "display", line: 38, maxLines: 2 });
  const detailEnd = write(card.detail, 180, titleEnd + 14, 13, 500, { color: "muted", maxLines: 2 });
  if (!compact && card.meaning) {
    const top = Math.max(321, detailEnd + 10);
    tile(28, top, 304, 140, 16);
    write("“" + card.meaning + "”", 180, top + 16, 14, 400, { width: 272, line: 18, maxLines: 5 });
    write(card.citation, 180, top + 113, 9, 700, { color: "muted", letterSpacing: ".6px", maxLines: 2 });
  }
  const progressTop = compact ? Math.max(244, detailEnd + 12) : 495;
  countBar(card.progress, progressTop, true);
  if (compact) write(card.citation.split("–")[0].split(" · ")[0], 180, progressTop + 43, 11, 500, { color: "muted", maxLines: 1 });
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

export async function drawShare(canvas: HTMLCanvasElement, model: ShareModel) {
  const { card, template, format, light } = model;
  const maktab = template === "maktab";
  const colors = palette(light, maktab);
  const { width, height, scale } = shareFormats[format];
  const w = width / scale;
  const h = height / scale;
  const motifName = format !== "story" ? "share-compact-motif" : maktab ? "share-maktab-motif" :
    template === "qaida" ? "share-qaida-motif" : template === "return" || template === "umrah" ? "share-return-motif" : "share-story-motif";
  const dotNames = template === "qaida" ? ["share-zabar-dot", "share-zer-dot", "share-pesh-dot"] : [];
  const [motif, fatha, dots] = await Promise.all([
    loadArtwork(motifName),
    loadArtwork(maktab ? "share-maktab-fatha" : "share-fatha"),
    Promise.all(dotNames.map(async name => [name, await loadArtwork(name)] as const)),
    document.fonts.load("600 76px " + arabicFont, card.arabic ?? card.tiles?.map(tile => tile.arabic).join(" ") ?? "ب"),
    document.fonts.load("600 42px " + colors.display, card.title),
    document.fonts.load("600 18px " + colors.body, card.detail),
    document.fonts.load("600 42px " + banglaFont, card.title + card.detail),
    document.fonts.load("650 26px " + shareSans),
  ]);
  await document.fonts.ready;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 0, w, h);

  const motifPosition = format === "wide" ? [420, 120] : format === "post" ? [200, -100] : {
    surah: [170, -120], words: [-150, 380], return: [190, 420], qaida: [-140, 430], umrah: [190, 430], maktab: [200, -120],
  }[template];
  ctx.drawImage(motif, ...motifPosition as [number, number]);

  const paint = painter(ctx, colors);
  ctx.save();
  if (format === "post" && template !== "surah") {
    ctx.translate(57.6, 6);
    ctx.scale(.68, .68);
  } else if (format === "wide" && template !== "words") {
    ctx.translate(362, 2);
    ctx.scale(.45, .45);
  }
  switch (template) {
    case "surah": drawSurah(paint, card, format === "post"); break;
    case "words": drawWords(paint, card, format === "wide"); break;
    case "return": drawReturning(paint, card, colors, model.showPrayerNumbers); break;
    case "qaida": drawQaida(paint, card, colors, Object.fromEntries(dots), ctx); break;
    case "umrah": drawUmrah(paint, card); break;
    case "maktab": drawMaktab(paint, card); break;
  }
  ctx.restore();

  const margin = format === "wide" ? 32 : 28;
  if (format === "wide" && template !== "words") {
    paint.badge(card.badge, margin, 28, "left");
    const end = paint.write(card.title, margin, 66, 36, 600, { face: "display", align: "left", width: 266, line: 40, maxLines: 3 });
    paint.write(card.detail, margin, end + 12, 14, 500, { align: "left", width: 266, color: "muted", line: 18, maxLines: 3 });
  }
  const footerTop = h - (format === "wide" ? 64 : 68);
  paint.write("awwab", margin, footerTop + 12, 26, 650, { face: "wordmark", align: "left", width: 120, maxLines: 1 });
  ctx.drawImage(fatha, margin + 2.94, footerTop + 12);
  paint.write("FREE · WORKS OFFLINE · NO ACCOUNT", w - margin, footerTop + 2, 10, 700, { align: "right", width: 216, color: "muted", letterSpacing: ".5px", maxLines: 1 });
  paint.write(footerLink, w - margin, footerTop + 20, 13, 600, { align: "right", width: 218, maxLines: 1 });
}

export function imageFile(canvas: HTMLCanvasElement, id: TemplateId) {
  return new Promise<File>((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(new File([blob], "awwab-" + id + ".png", { type: "image/png" }));
    else reject(new Error("Image could not be rendered."));
  }, "image/png"));
}
