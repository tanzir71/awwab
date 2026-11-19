import { describe, expect, it } from "vitest";
import { calculateZakat, gramsPerBhori, nisabWeight } from "./zakat";
import { advanceSai, bearing, correctSai, distance, initialSai } from "./umrah";
import { eventDisplayDates } from "./hijri";
import { qadaBalances, qadaDefaults } from "./qada";

describe("Today summaries", () => {
  it("shows both possible three-day White Days windows across a Gregorian month boundary", () => {
    expect(eventDisplayDates({
      id: "1448-6-11", title: "White days (Ayyām al-Bīḍ)", label: "13–15 every month", kind: "follows-month",
      year: 1448, month: 6, hijriMonth: 0, hijriDay: 13, dates: ["2026-11-28", "2026-11-29"], confirmed: false, source: undefined,
    }, "en", " or ")).toBe("28–30 Nov or 29 Nov–1 Dec");
  });

  it("combines recorded make-ups and manual counts without reducing other prayer balances", () => {
    const plan = { ...qadaDefaults, estimated: { ...qadaDefaults.estimated, fajr: 2, asr: 3 }, madeUp: { ...qadaDefaults.madeUp, fajr: 2 } };
    const at = "2026-11-19T10:00:00.000Z";
    const result = qadaBalances(plan, [
      { date: "2026-11-19", prayer: "fajr", status: "qada", at },
      { date: "2026-11-19", prayer: "asr", status: "done", at },
    ]);
    expect(result.madeUp.fajr).toBe(3);
    expect(result.remaining.fajr).toBe(0);
    expect(result.remaining.asr).toBe(3);
    expect(result.totalLeft).toBe(3);
  });
});

describe("zakat", () => {
  it("uses equivalent gram and bhori thresholds and applies 2.5 percent to net assets", () => {
    expect(nisabWeight("silver", "g")).toBe(595);
    expect(nisabWeight("gold", "g")).toBe(85);
    expect(nisabWeight("silver", "bhori")).toBeCloseTo(51.01, 2);
    expect(nisabWeight("gold", "bhori")).toBeCloseTo(7.29, 2);
    const gram = calculateZakat([80_000, 23_000], [3_000], "silver", 100, "g");
    const bhori = calculateZakat([80_000, 23_000], [3_000], "silver", 100 * gramsPerBhori, "bhori");
    expect(gram).toEqual({ net: 100_000, nisab: 59_500, due: 2500 });
    expect(bhori.nisab).toBeCloseTo(gram.nisab, 6);
    expect(calculateZakat([5000], [], "silver", 100, "g").due).toBe(0);
    expect(calculateZakat([70000], [], "silver", 0, "g").due).toBeUndefined();
  });
});

describe("saʿy location hysteresis", () => {
  it("requires an exit, the opposite end, 60 seconds and 300 meters before a lap", () => {
    const start = advanceSai(initialSai, "safa", 1000, 400);
    expect(advanceSai(start, "marwah", 70_000, 400)).toBe(start);
    const left = advanceSai(start, undefined, 3000, 400);
    expect(advanceSai(left, "safa", 80_000, 400)).toBe(left);
    expect(advanceSai(left, "marwah", 50_000, 400)).toBe(left);
    expect(advanceSai(left, "marwah", 80_000, 200)).toBe(left);
    expect(advanceSai(left, "marwah", 80_000, 400)).toMatchObject({ count: 1, last: "marwah", exited: false });
  });

  it("caps manual and automatic counts and preserves the expected alternating end", () => {
    const corrected = correctSai(initialSai, 9, 1000);
    expect(corrected).toMatchObject({ count: 7, last: "marwah" });
    expect(advanceSai(corrected, "safa", 80_000, 400)).toBe(corrected);
  });

  it("calculates hotel distance and bearing without a network", () => {
    expect(distance({ lat: 0, lon: 0 }, { lat: 0, lon: .01 })).toBeCloseTo(1111.95, 1);
    expect(bearing({ lat: 0, lon: 0 }, { lat: 0, lon: .01 })).toBe(90);
  });
});
