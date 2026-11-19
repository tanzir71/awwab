export type NisabBasis = "silver" | "gold";
export type MetalUnit = "g" | "bhori";
export const gramsPerBhori = 11.664;
export const nisabGrams = { silver: 595, gold: 85 } as const;

export function nisabWeight(basis: NisabBasis, unit: MetalUnit) {
  return nisabGrams[basis] / (unit === "bhori" ? gramsPerBhori : 1);
}

export function calculateZakat(assets: number[], debts: number[], basis: NisabBasis, price: number, unit: MetalUnit) {
  const total = (items: number[]) => items.reduce((sum, value) => sum + Math.max(0, value), 0);
  const net = Math.max(0, total(assets) - total(debts));
  const nisab = price > 0 ? nisabWeight(basis, unit) * price : undefined;
  const due = nisab !== undefined ? (net >= nisab ? Math.round(net * 2.5) / 100 : 0) : undefined;
  return { net, nisab, due };
}

export const initialZakat = {
  basis: "silver" as NisabBasis, unit: "g" as MetalUnit, price: 0, cash: 0, metals: 0, trade: 0, debt: 0,
  currency: "BDT", hawlMonth: 9, hawlDay: 1, payments: [] as { day: string; amount: number; currency: string }[],
};

export function zakatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}
