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

export function formatDay(day: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: options ? undefined : "full", ...options, timeZone: "UTC" })
    .format(new Date(`${day}T12:00:00Z`));
}

export function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

export function duration(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
