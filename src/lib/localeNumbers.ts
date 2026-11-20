export function latinDigits(value: string, locale: string) {
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const local = Array.from({ length: 10 }, (_, digit) => number.format(digit));
  const common = "0123456789০১২৩৪৫৬৭৮৯٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
  return value.replace(/\p{Decimal_Number}/gu, digit => {
    const index = local.indexOf(digit);
    if (index !== -1) return String(index);
    const fallback = common.indexOf(digit);
    return fallback === -1 ? digit : String(fallback % 10);
  });
}

function decimalSeparator(locale: string) {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find(part => part.type === "decimal")?.value ?? ".";
}

export function formatInputNumber(value: number, locale: string) {
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const decimal = decimalSeparator(locale);
  return String(value).replace(/[0-9.]/g, digit => digit === "." ? decimal : number.format(Number(digit)));
}

export function readLocalizedNumber(value: string, locale: string, decimals: number | "any" = 0) {
  let text = latinDigits(value.trim(), locale);
  if (decimals) {
    text = text.replace(/٫/g, ".");
    const decimal = decimalSeparator(locale);
    if (decimal !== "." && !text.includes(".")) text = text.replace(decimal, ".");
  }
  if (decimals === "any") {
    if (!/^(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return undefined;
    const number = Number(text);
    return Number.isFinite(number) ? number : undefined;
  }
  if (!/^(?:\d+|\d*\.\d+)$/.test(text)) return undefined;
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals || !Number.isSafeInteger(Number(whole))) return undefined;
  const number = Number(text);
  return number <= Number.MAX_SAFE_INTEGER ? number : undefined;
}
