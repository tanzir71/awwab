import { SHARE_URL, asset } from "./config";

export const shareTemplates = [
  { id: "surah", label: "Surah learned", arabic: "الْعَصْرِ", detail: "A few āyāt at a time.", theme: "dark" },
  { id: "words", label: "Quran words", arabic: "يَوْمٌ", detail: "Getting to know the words I recite.", theme: "dark" },
  { id: "return", label: "Coming back", arabic: "أَوَّاب", detail: "I’m making room for prayer again.", theme: "dark" },
  { id: "qaida", label: "Qaida lesson", arabic: "بَ بِ بُ", detail: "Learning to read, one letter at a time.", theme: "light" },
  { id: "umrah", label: "Umrah day", arabic: "", detail: "Remember us in your duʿā.", theme: "dark" },
  { id: "maktab", label: "Maktab milestone", arabic: "ا ب ت ث", detail: "One step further on my Qaida path.", theme: "light" },
] as const;

export type TemplateId = typeof shareTemplates[number]["id"];
export const shareFormats = {
  story: { label: "Story", width: 1080, height: 1920 },
  post: { label: "Post", width: 1080, height: 1350 },
  wide: { label: "Wide", width: 1200, height: 630 },
};
export type ShareFormat = keyof typeof shareFormats;

export interface ShareModel {
  template: TemplateId;
  format: ShareFormat;
  light: boolean;
  detail?: string;
  title?: string;
  showPrayerNumbers: boolean;
  prayerCount: number;
  activity: number[];
}

export const shareUrl = (id: TemplateId) => `${SHARE_URL}?ref=share-${id}`;

function wrap(ctx: CanvasRenderingContext2D, value: string, width: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(" ")) {
    const line = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(line).width > width) { lines.push(current); current = word; }
    else current = line;
  }
  return [...lines, current];
}

export async function drawShare(canvas: HTMLCanvasElement, model: ShareModel) {
  const card = shareTemplates.find(item => item.id === model.template);
  const title = model.title || card.label;
  const detail = model.detail || card.detail;
  const bangla = /\p{Script=Bengali}/u;
  const titleFont = bangla.test(title) ? '"Noto Sans Bengali Variable"' : '"Noto Serif Variable"';
  const detailFont = bangla.test(detail) ? '"Noto Sans Bengali Variable"' : '"Noto Sans Variable"';
  const { width, height } = shareFormats[model.format];
  const root = getComputedStyle(document.documentElement);
  const token = (key: string) => root.getPropertyValue(`--c-${key}`).trim();
  const text = token(model.light ? "ink" : "on-night");
  const muted = token(model.light ? "ink-muted" : "night-muted");
  const ground = token(model.light ? "bg" : "night");
  await Promise.all([
    document.fonts.load('650 50px "Noto Sans Variable"'),
    document.fonts.load(`600 80px ${titleFont}`, title),
    document.fonts.load(`500 42px ${detailFont}`, detail),
    document.fonts.load('600 120px "Noto Sans Arabic Variable"', card.arabic),
  ]);
  await document.fonts.ready;
  const motif = new Image();
  motif.src = asset("design/today-motifstar8.svg");
  await motif.decode().catch(() => {});

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const margin = model.format === "wide" ? 62 : 78;
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);
  if (motif.complete && motif.naturalWidth) {
    ctx.globalAlpha = model.light ? .2 : .48;
    ctx.drawImage(motif, width - 370, -220, 580, 580);
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = muted;
  ctx.font = '650 27px "Noto Sans Variable"';
  ctx.fillText("AWWAB", margin, margin + 26);
  let y = model.format === "wide" ? 221 : height * .27;
  ctx.fillStyle = text;
  ctx.font = `600 ${model.format === "wide" ? 64 : 92}px ${titleFont}`;
  for (const line of wrap(ctx, title, width - 2 * margin)) {
    ctx.fillText(line, margin, y);
    y += model.format === "wide" ? 72 : 104;
  }
  if (card.arabic && model.format !== "wide") {
    ctx.font = '600 153px "Noto Sans Arabic Variable"';
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillText(card.arabic, width - margin, y + 80, width - 2 * margin);
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    y += 170;
  }
  ctx.fillStyle = muted;
  ctx.font = `500 ${model.format === "wide" ? 35 : 42}px ${detailFont}`;
  for (const line of wrap(ctx, detail, width - 2 * margin)) { ctx.fillText(line, margin, y); y += 54; }
  if (model.template === "return" && model.activity.length && model.format !== "wide") {
    const step = Math.floor((width - 2 * margin) / 53);
    model.activity.slice(-371).forEach((count, index) => {
      ctx.fillStyle = count ? token("accent") : muted;
      ctx.globalAlpha = count ? .98 : .18;
      ctx.fillRect(margin + step * Math.floor(index / 7), y + 26 + (index % 7) * step, step - 3, step - 3);
    });
    ctx.globalAlpha = 1;
    y += 172;
  }
  if (model.showPrayerNumbers && model.template === "return") ctx.fillText(`${model.prayerCount} prayers recorded`, margin, y + 10);
  const footerY = height - (model.format === "wide" ? 105 : 153);
  ctx.fillStyle = text;
  ctx.font = '650 54px "Noto Sans Variable"';
  ctx.fillText("awwab", margin, footerY);
  ctx.strokeStyle = token("accent");
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(margin + 5, footerY - 39);
  ctx.lineTo(margin + 24, footerY - 46);
  ctx.stroke();
  ctx.font = '500 26px "Noto Sans Variable"';
  ctx.fillStyle = muted;
  ctx.fillText("For those who keep coming back.", margin, footerY + 37);
  ctx.fillText(SHARE_URL.replace(/^https:\/\//, ""), margin, footerY + 73);
}

export function imageFile(canvas: HTMLCanvasElement, id: TemplateId) {
  return new Promise<File>((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(new File([blob], `awwab-${id}.png`, { type: "image/png" }));
    else reject(new Error("Image could not be rendered."));
  }, "image/png"));
}
