import { describe, expect, it } from "vitest";
import { calculateZakat, gramsPerBhori, initialZakat, nisabWeight, paymentsForHawl,
  zakatHawl, zakatMoney, zakatPrices, zakatProfileTotals, type ZakatProfile } from "./zakat";
import { advanceSai, bearing, correctSai, distance, initialSai } from "./umrah";
import { addDays } from "./dates";
import { baselineMonthStart, calendarDefaults, calendarEventById, dayDifference, eventDisplayDates, monthStartEvent } from "./hijri";
import { eventReminders } from "./calendarFile";
import { calendarDayEvents, calendarWeekStart, fridayMosque, gregorianMonthCells, readCalendarDay, readCalendarMonth, shiftPlanEvent } from "./plan-calendar";
import { defaults, prayerStatistics } from "./storageService";
import { adjustQadaTotals, qadaBalances, qadaCountBetween, qadaDefaults, qadaForecast, recordQada } from "./qada";
import { assignedMosque, mapMosque, mosqueCheckedAge, mosqueDefaults, mosqueTime, mosqueWeek, timetableNotice, weeklyMosque, type Mosque } from "./mosques";

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

  it("counts dated make-ups in the selected week and uses the local recording date for older prayers", () => {
    const legacy = { ...qadaDefaults, madeUp: { ...qadaDefaults.madeUp, fajr: 5 } };
    const plan = recordQada(recordQada(legacy, "fajr", "2026-11-15"), "asr", "2026-11-10");
    const logs = [
      { date: "2026-11-02", prayer: "fajr", status: "qada", at: "2026-11-14T18:10:00.000Z" },
      { date: "2026-11-10", prayer: "fajr", status: "qada", at: "2026-11-14T17:59:00.000Z" },
      { date: "2026-11-19", prayer: "asr", status: "done", at: "2026-11-19T08:00:00.000Z" },
    ] as const;
    expect(qadaCountBetween(legacy, [], "2026-11-15", "2026-11-19", "Asia/Dhaka")).toBe(0);
    expect(qadaCountBetween(plan, [...logs], "2026-11-15", "2026-11-19", "Asia/Dhaka")).toBe(2);
    expect(qadaBalances(plan, [...logs]).madeUp.fajr).toBe(8);
  });

  it("keeps dated make-ups through legacy adjustments and trims recent entries when the balance is smaller", () => {
    const legacy = { ...qadaDefaults, madeUp: { ...qadaDefaults.madeUp, fajr: 3 } };
    const plan = recordQada(recordQada(recordQada(legacy, "fajr", "2026-11-16"), "fajr", "2026-11-19"), "asr", "2026-11-19");
    expect(adjustQadaTotals(plan, plan.estimated, { ...plan.madeUp, fajr: 2 }).manualDays).toEqual(plan.manualDays);
    expect(adjustQadaTotals(plan, plan.estimated, { ...plan.madeUp, fajr: 1 }).manualDays).toEqual({
      "2026-11-16": { fajr: 1 }, "2026-11-19": { fajr: 0, asr: 1 },
    });
  });

  it("returns the actual comeback dates once each and ignores future logs", () => {
    const logs = ["2026-11-01", "2026-11-02", "2026-11-04", "2026-11-04", "2026-11-11", "2026-11-21"].map(date =>
      ({ date, prayer: "fajr" as const, status: "done" as const, at: date + "T10:00:00Z" }));
    expect(prayerStatistics(logs, "2026-11-19")).toMatchObject({ returns: 2, returnDays: ["2026-11-04", "2026-11-11"] });
  });
});

describe("desktop Plan calendar", () => {
  it("uses full Gregorian weeks, includes neighbouring days and honours the locale’s week start", () => {
    expect(calendarWeekStart("en", "Asia/Dhaka", ["en-GB"])).toBe(0);
    expect(calendarWeekStart("en", "Europe/London", ["en-GB"])).toBe(1);
    expect(calendarWeekStart("bn", "Europe/London", ["en-GB"])).toBe(0);
    const sunday = gregorianMonthCells("2026-12", 0, 0, calendarDefaults);
    const monday = gregorianMonthCells("2026-12", 1, 0, calendarDefaults);
    expect(sunday[0]).toMatchObject({ day: "2026-11-29", adjacent: true, weekday: 0 });
    expect(sunday.at(-1)).toMatchObject({ day: "2027-01-02", adjacent: true, weekday: 6 });
    expect(monday[0]).toMatchObject({ day: "2026-11-30", adjacent: true, weekday: 1 });
    expect(monday.at(-1)).toMatchObject({ day: "2027-01-03", adjacent: true, weekday: 0 });
    expect(sunday).toHaveLength(35);
  });

  it("shows both expected Rajab dates and highlights every day of the two White Days windows once", () => {
    const grid = gregorianMonthCells("2026-12", 0, 0, calendarDefaults);
    const rajab = grid.filter(cell => cell.events.some(item => item.title === "Rajab begins"));
    expect(rajab.map(cell => cell.day)).toEqual(["2026-12-10", "2026-12-11"]);
    const decemberWhiteDays = grid.filter(cell => cell.day.startsWith("2026-12-2") &&
      cell.events.some(item => item.title.startsWith("White days")));
    expect(decemberWhiteDays.map(cell => cell.day)).toEqual(["2026-12-22", "2026-12-23", "2026-12-24", "2026-12-25"]);
    expect(calendarDayEvents("2026-12-23", 0, calendarDefaults).filter(item => item.title.startsWith("White days"))).toHaveLength(1);
    const config = { ...calendarDefaults, anchors: [{ year: 1448, month: 7, date: "2026-12-11", source: "Family" }] };
    const confirmed = gregorianMonthCells("2026-12", 0, 0, config)
      .filter(cell => cell.events.some(item => item.title === "Rajab begins"));
    expect(confirmed).toMatchObject([{ day: "2026-12-11", hijri: { day: 1 } }]);
  });

  it("exports a shift or confirmation even for a month without a named observance", () => {
    const start = monthStartEvent(1448, 8, 0, calendarDefaults);
    const shifted = shiftPlanEvent(calendarDefaults, start.id, 1);
    const expected = calendarEventById(start.id, 0, shifted);
    expect(expected).toMatchObject({ confirmed: false, dates: start.dates.map(day => addDays(day, 1)) });
    expect(eventReminders("2026-12-01", defaults, shifted).filter(item => item.id.startsWith("event-" + start.id)).map(item => item.start)).toEqual(expected.dates);
    expect(shiftPlanEvent(shifted, start.id, 1)).toEqual(calendarDefaults);
    const confirmed = { ...calendarDefaults, anchors: [{ year: 1448, month: 8, date: start.dates[1], source: "My mosque" }] };
    expect(eventReminders("2026-12-01", defaults, confirmed).find(item => item.id === "event-" + start.id + "-0")?.start).toBe(start.dates[1]);
  });

  it("uses the Friday assignment, and supports a single saved Jumuʿah mosque as a fallback", () => {
    const role: Mosque = { id: "j", name: "Friday Masjid", role: "jumuah", jamaat: {}, jumuah: { khutbah: "13:00", prayer: "13:15" },
      occasional: [], source: "imam", updatedAt: "2026-11-19T10:00:00Z" };
    const home: Mosque = { ...role, id: "h", role: "home", jumuah: { khutbah: "12:30", prayer: "12:45" } };
    const plan = { ...mosqueDefaults, mosques: [home, role] };
    expect(fridayMosque(plan)).toBe(role);
    expect(fridayMosque(mapMosque(plan, [5], "dhuhr", home.id))).toBe(home);
    expect(fridayMosque({ ...plan, mosques: [role, { ...role, id: "j2" }] })).toBeUndefined();
  });

  it("accepts legitimate dated links and rejects invalid or out-of-range values", () => {
    const today = "2026-11-19";
    expect(readCalendarDay("2028-02-29", today)).toBe("2028-02-29");
    expect(readCalendarDay("2027-02-29", today)).toBeUndefined();
    expect(readCalendarDay("0002-01-01", today)).toBeUndefined();
    expect(readCalendarMonth("2026-13", today)).toBe("2026-11");
    expect(readCalendarMonth("2026-12", today)).toBe("2026-12");
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

  it("formats the last-check age and clears a seasonal reminder after a check today", () => {
    expect(mosqueCheckedAge("2026-11-19", "2026-11-19", "en")).toBe("today");
    expect(mosqueCheckedAge("2026-11-19", "2026-11-05", "en")).toBe("2 weeks ago");
    expect(mosqueCheckedAge("2026-11-19", "2026-08-14", "en")).toBe("3 months ago");
    expect(timetableNotice("2026-11-19", "2026-08-14", 11)).toBe("seasonal");
    expect(timetableNotice("2026-11-19", "2026-11-19", 11)).toBeUndefined();
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
