const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function dateKey(date = new Date(), timeZone?: string) {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  let formatter = dateFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFormatters.set(zone, formatter);
  }
  const parts = formatter.formatToParts(date);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}

export function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatDay(day: string, options?: Intl.DateTimeFormatOptions, language = "en-GB") {
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : language, {
    dateStyle: options ? undefined : "full", calendar: "gregory", ...options, timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

export function formatTime(date: Date, timeZone: string, language = "en", compact = false) {
  const formatter = new Intl.DateTimeFormat(language, { timeZone, hour: "numeric", minute: "2-digit" });
  return compact ? formatter.formatToParts(date).filter(part => part.type !== "dayPeriod").map(part => part.value).join("").trim() : formatter.format(date);
}

export function duration(ms: number, language = "en") {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  if (language === "bn" || language.startsWith("bn-")) {
    const number = new Intl.NumberFormat(language);
    return hours ? `${number.format(hours)} ঘণ্টা ${number.format(minutes % 60)} মিনিট` : `${number.format(minutes)} মিনিট`;
  }
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
