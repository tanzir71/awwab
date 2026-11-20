import { addDays } from "./dates";
import { dayDifference, hijriOn, monthStart, type MonthAnchor } from "./hijri";

export type NisabBasis = "silver" | "gold";
export type MetalUnit = "g" | "bhori";
export const gramsPerBhori = 11.664;
export const nisabGrams = { silver: 595, gold: 85 } as const;
export const metalKinds = ["gold", "silver"] as const;
export const metalLabels = { gold: "zakatGold", silver: "zakatSilver" } as const;
export const zakatBalances = ["cash", "metals", "trade", "receivables", "debt"] as const;
export type ZakatBalance = typeof zakatBalances[number];
export const balanceLabels = {
  cash: "zakatCash", metals: "zakatMetals", trade: "zakatTrade", receivables: "zakatReceivables", debt: "zakatDebt",
} as const;
export const zakatSources = {
  zakatBukhariSource: "https://sunnah.com/bukhari:1454",
  zakatJewellerySource: "https://www.dar-alifta.org/en/fatwa/details/7705/is-zakat-payable-on-the-gold-and-silver-jewelry-that-a-woman-owns",
} as const;

export type ZakatAsset = { id: string; name: string } & (
  { kind: ZakatBalance; amount: number }
  | { kind: "metal"; basis: NisabBasis; weight: number; unit: MetalUnit; purity: number }
);

export type ZakatProfile = {
  basis: NisabBasis; unit: MetalUnit; price: number; currency: string;
  cash: number; metals: number; trade: number; debt: number; receivables?: number;
  prices?: Partial<Record<NisabBasis, number>>;
  assets?: ZakatAsset[];
  hawlMonth: number; hawlDay: number; hawlSet?: boolean;
  payments: { day: string; amount: number; currency: string; hawlYear?: number; name?: string }[];
};

export function unitGrams(unit: MetalUnit) {
  return unit === "bhori" ? gramsPerBhori : 1;
}

export function nisabWeight(basis: NisabBasis, unit: MetalUnit) {
  return nisabGrams[basis] / unitGrams(unit);
}

export function calculateZakat(assets: number[], debts: number[], basis: NisabBasis, price: number, unit: MetalUnit) {
  const total = (items: number[]) => items.reduce((sum, value) => sum + Math.max(0, value), 0);
  const net = Math.max(0, total(assets) - total(debts));
  const nisab = price > 0 ? nisabWeight(basis, unit) * price : undefined;
  const due = nisab !== undefined ? (net >= nisab ? Math.round(net * 2.5) / 100 : 0) : undefined;
  return { net, nisab, due };
}

export const initialZakat: ZakatProfile = {
  basis: "silver", unit: "g", price: 0, cash: 0, metals: 0, trade: 0, debt: 0,
  currency: "BDT", hawlMonth: 9, hawlDay: 1, hawlSet: false, payments: [],
};

export function zakatPrices(profile: ZakatProfile) {
  return profile.prices ?? (profile.price ? { [profile.basis]: profile.price / unitGrams(profile.unit) } : {});
}

export function zakatProfileTotals(profile: ZakatProfile) {
  const prices = zakatPrices(profile);
  const totals = { cash: profile.cash, metals: profile.metals, trade: profile.trade, receivables: profile.receivables ?? 0, debt: profile.debt };
  const assets = (profile.assets ?? []).map(asset => {
    if (asset.kind !== "metal") {
      totals[asset.kind] += asset.amount;
      return { asset, value: asset.amount };
    }
    const price = prices[asset.basis];
    const value = price && asset.weight * (asset.purity / 100) * unitGrams(asset.unit) * price;
    if (!value || !Number.isFinite(value)) return { asset, value: undefined };
    totals.metals += value;
    return { asset, value };
  });
  const { net, nisab, due } = calculateZakat([totals.cash, totals.metals, totals.trade, totals.receivables], [totals.debt],
    profile.basis, prices[profile.basis] ?? 0, "g");
  const complete = Number.isFinite(net) && assets.every(item => item.value !== undefined);
  return { totals, assets, complete, net: complete ? net : undefined, nisab, due: complete ? due : undefined };
}

export function zakatHawl(today: string, profile: ZakatProfile | null, adjustment: number, anchors: MonthAnchor[]) {
  if (!profile || profile.hawlSet === false) return undefined;
  const { hawlMonth: month, hawlDay } = profile;
  const current = hijriOn(today, adjustment, anchors);
  const occurrence = (year: number) => {
    const start = monthStart(year, month, adjustment, anchors).date;
    const end = monthStart(year + Number(month === 12), month % 12 + 1, adjustment, anchors).date;
    const day = Math.max(1, Math.min(hawlDay, dayDifference(end, start)));
    return { year, month, day, date: addDays(start, day - 1) };
  };
  const thisYear = occurrence(current.year);
  const next = thisYear.date >= today ? thisYear : occurrence(current.year + 1);
  return { ...next, previous: occurrence(next.year - 1).date, daysUntil: dayDifference(next.date, today), shorterMonth: next.day !== hawlDay };
}

export function zakatMoney(amount: number, currency: string, language = "en", lakh = false) {
  const locale = language === "bn" ? "bn-BD" : !language.startsWith("bn-") && lakh && currency === "BDT" ? "en-IN" : language;
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 2 })
    .formatToParts(amount).map(part => part.value === "৳" ? "৳ " : part.value).join("");
}

export function paymentsForHawl(profile: ZakatProfile, hawl: ReturnType<typeof zakatHawl>) {
  if (!hawl) return profile.payments;
  return profile.payments.filter(payment => payment.currency === profile.currency &&
    (payment.hawlYear === undefined ? payment.day > hawl.previous && payment.day <= hawl.date : payment.hawlYear === hawl.year));
}
