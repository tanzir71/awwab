import { describe, expect, it } from "vitest";
import { calculateZakat, gramsPerBhori, initialZakat, nisabWeight, paymentsForHawl,
  zakatHawl, zakatMoney, zakatPrices, zakatProfileTotals, type ZakatProfile } from "./zakat";
import { advanceSai, bearing, correctSai, distance, initialSai } from "./umrah";
import { addDays } from "./dates";
import { baselineMonthStart, dayDifference, eventDisplayDates } from "./hijri";
import { qadaBalances, qadaDefaults, qadaForecast } from "./qada";
import { assignedMosque, mapMosque, mosqueDefaults, mosqueTime, mosqueWeek, timetableNotice, weeklyMosque, type Mosque } from "./mosques";

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

  it("forecasts make-ups with each prayer using the largest remaining balance", () => {
    const balances = qadaBalances({ ...qadaDefaults, estimated: { ...qadaDefaults.estimated, fajr: 7, asr: 2 } }, []);
    const today = "2026-11-19";
    expect(qadaForecast(today, balances, { dailyGoal: 3 })).toEqual({ days: 3, end: "2026-11-21" });
    expect(qadaForecast(today, balances, { dailyGoal: 3, withEachPrayer: true })).toEqual({ days: 7, end: "2026-11-25" });
    expect(qadaForecast(today, qadaBalances(qadaDefaults, []), { dailyGoal: 3, withEachPrayer: true })).toEqual({ days: 0, end: null });
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

  it("values weighed jewellery by purity and includes all owned assets and current debts", () => {
    const profile: ZakatProfile = { ...initialZakat, cash: 340_000, prices: { silver: 230, gold: 18_000 }, assets: [
      { id: "bracelet", name: "", kind: "metal", basis: "gold", unit: "bhori", weight: 2, purity: 22 / 24 * 100 },
      { id: "owed", name: "", kind: "receivables", amount: 50_000 },
      { id: "stock", name: "", kind: "trade", amount: 5000 },
      { id: "debt", name: "", kind: "debt", amount: 30_000 },
    ] };
    const result = zakatProfileTotals(profile);
    expect(result.totals.metals).toBeCloseTo(384_912, 4);
    expect(result.net).toBeCloseTo(749_912, 4);
    expect(result.due).toBe(18_747.8);
    expect(result.nisab).toBe(136_850);
    expect(zakatProfileTotals({ ...profile, basis: "gold" }).due).toBe(0);
    expect(zakatProfileTotals({ ...profile, prices: { silver: 230 } })).toMatchObject({
      complete: false, net: undefined, due: undefined, nisab: 136_850,
    });
    expect(zakatMoney(result.net, "BDT", "en", true)).toBe("৳ 7,49,912");
  });

  it("reads the single saved price from an older profile in its original unit", () => {
    const legacy: ZakatProfile = { ...initialZakat, unit: "bhori", price: 100 * gramsPerBhori, cash: 100_000 };
    expect(zakatPrices(legacy).silver).toBeCloseTo(100);
    const result = zakatProfileTotals(legacy);
    expect(result).toMatchObject({ complete: true, net: 100_000, due: 2500 });
    expect(result.nisab).toBeCloseTo(59_500);
  });

  it("moves the hawl with the confirmed month and uses the last day of a shorter month", () => {
    const year = 1448;
    const month = Array.from({ length: 11 }, (_, i) => i + 1)
      .find(m => dayDifference(baselineMonthStart(year, m + 1), baselineMonthStart(year, m)) === 29);
    const start = baselineMonthStart(year, month);
    const profile: ZakatProfile = { ...initialZakat, hawlSet: true, hawlMonth: month, hawlDay: 30 };
    expect(zakatHawl(start, initialZakat, 0, [])).toBeUndefined();
    const hawl = zakatHawl(start, profile, 0, []);
    expect(hawl).toMatchObject({ date: addDays(start, 28), day: 29, year, month, daysUntil: 28, shorterMonth: true });
    const anchor = { year, month, date: addDays(start, 1), source: "Local sighting" };
    expect(zakatHawl(start, profile, 0, [anchor])).toMatchObject({ date: addDays(start, 29), day: 29, daysUntil: 29 });
    expect(zakatHawl(addDays(hawl.date, 1), profile, 0, []).year).toBe(year + 1);
  });

  it("matches explicit Hijri cycles and older dated payments in the saved currency", () => {
    const profile: ZakatProfile = { ...initialZakat, hawlMonth: 10, hawlDay: 4, hawlSet: true };
    const hawl = zakatHawl("2026-11-19", profile, 0, []);
    const explicit = { day: hawl.previous, hawlYear: hawl.year, currency: "BDT", amount: 8 };
    const legacy = { day: hawl.date, currency: "BDT", amount: 5 };
    profile.payments = [explicit, legacy, { ...legacy, currency: "USD" }, { ...legacy, day: hawl.previous },
      { ...legacy, hawlYear: hawl.year - 1 }];
    expect(paymentsForHawl(profile, hawl)).toEqual([explicit, legacy]);
    expect(paymentsForHawl(profile, undefined)).toEqual(profile.payments);
  });
});

describe("mosque timetables", () => {
  const home: Mosque = { id: "home", name: "Home masjid", role: "home", jamaat: { dhuhr: "13:00" },
    jumuah: { khutbah: "12:45", prayer: "13:15" }, occasional: [], source: "visited", updatedAt: "2026-10-12T12:00:00Z" };
  const office: Mosque = { ...home, id: "office", name: "Office masjid", role: "office", jumuah: undefined };

  it("supports grouped assignments and changes to a single weekday without touching the other days", () => {
    let plan = { ...mosqueDefaults, mosques: [home, office] };
    plan = mapMosque(plan, mosqueWeek[0], "dhuhr", office.id);
    plan = mapMosque(plan, mosqueWeek[1], "dhuhr", home.id);
    plan = mapMosque(plan, [3], "dhuhr", home.id);
    expect(assignedMosque(2, "dhuhr", plan)?.id).toBe("office");
    expect(assignedMosque(3, "dhuhr", plan)?.id).toBe("home");
    expect(weeklyMosque(mosqueWeek[0], "dhuhr", plan)).toMatchObject({ differentMosques: true });
    expect(weeklyMosque(mosqueWeek[1], "dhuhr", plan)).toMatchObject({ mosque: home, differentTimes: true });
    expect(mosqueTime(assignedMosque(5, "dhuhr", plan), "dhuhr", 5)).toBe("13:15");
    expect(mosqueTime(assignedMosque(6, "dhuhr", plan), "dhuhr", 6)).toBe("13:00");
    expect(assignedMosque(3, "dhuhr", mapMosque(plan, [3], "dhuhr", ""))).toBeUndefined();
    expect(mapMosque(plan, [1], "dhuhr", "unknown-mosque")).toBe(plan);
  });

  it("prompts for configured changes, age, and upcoming observances using the last checked date", () => {
    expect(timetableNotice("2026-11-02", "2026-10-27", 11)).toBe("seasonal");
    expect(timetableNotice("2026-11-02", "2026-11-01", 11)).toBeUndefined();
    expect(timetableNotice("2026-11-19", "2026-02-10")).toBe("older");
    expect(timetableNotice("2027-01-29", "2026-12-10", undefined, "ramadan")).toBe("ramadan");
    expect(timetableNotice("2027-03-02", "2027-02-22", undefined, "eid")).toBeUndefined();
    expect(timetableNotice("2027-03-02", "2027-01-22", undefined, "eid")).toBe("eid");
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
