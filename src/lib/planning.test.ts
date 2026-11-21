import { describe, expect, it, vi } from "vitest";
import { calculateZakat, gramsPerBhori, initialZakat, nisabWeight, paymentsForHawl,
  zakatHawl, zakatMoney, zakatPrices, zakatProfileTotals, type ZakatProfile } from "./zakat";
import { advanceSai, bearing, correctSai, distance, emptyPreparation, initialSai, initialTrip, makkah,
  saiGuidePosition, saiLapEnds, tawafRounds, toggleUmrahDua, tripDates, umrahContext } from "./umrah";
import { observeHaramGate, type GateWatch, type HaramOutline } from "./umrahGateMemory";
import { mapPlaceMatches, nearbyMapPoint, placeRegion } from "./umrahMapPlaces";
import { addDays, duration, formatTime } from "./dates";
import { baselineMonthStart, calendarDefaults, calendarEventById, dayDifference, eventDisplayDates, hijriLabel, monthStartEvent } from "./hijri";
import { eventReminders } from "./calendarFile";
import { prayerDay, schedule } from "./prayerServices";
import { calendarDayEvents, calendarWeekStart, fridayMosque, gregorianMonthCells, readCalendarDay, readCalendarMonth, shiftPlanEvent } from "./plan-calendar";
import { defaults, exportUmrahTrip, prayerStatistics, readUmrahTripFile } from "./storageService";
import { askMeaning, askPhrase, askPhraseMatches, quickAsks, readGate, renderAsk, umrahPhrases } from "./umrahAsk";
import { message } from "./copy";
import { adjustQadaTotals, qadaBalances, qadaCountBetween, qadaDefaults, qadaForecast, recordQada } from "./qada";
import { assignedMosque, jamaatForPrayer, mapMosque, mosqueCheckedAge, mosqueDefaults, mosqueInputClock, mosqueTime, mosqueWeek,
  parseMosqueClock, timetableNotice, weeklyMosque, type Mosque } from "./mosques";
import { formatInputNumber, latinDigits, readCoordinatePair, readLocalizedNumber } from "./localeNumbers";

describe("localized number entry", () => {
  it("reads Bangla, Latin and locale-specific digits and decimal separators", () => {
    expect(readLocalizedNumber("০", "bn")).toBe(0);
    expect(readLocalizedNumber(" ১২৩ ", "bn-u-nu-latn")).toBe(123);
    expect(readLocalizedNumber("১.২৫", "bn", 2)).toBe(1.25);
    expect(readLocalizedNumber(".25", "bn", 2)).toBe(0.25);
    expect(readLocalizedNumber("١٫٢٥", "ar", 2)).toBe(1.25);
    expect(readLocalizedNumber("۱۲٫۵۰", "fa-u-nu-latn", 2)).toBe(12.5);
    expect(readLocalizedNumber("١٢", "ckb-u-nu-latn")).toBe(12);
    expect(readLocalizedNumber("1,25", "fr", 2)).toBe(1.25);
    expect(readLocalizedNumber("१२", "hi-u-nu-deva")).toBe(12);
  });

  it("rejects blank, negative, malformed, unsafe and over-precise quantities", () => {
    for (const value of ["", " ", "-১", "৩.৫", "3e2", "১,০০০", "0x01", "৯০০৭১৯৯২৫৪৭৪০৯৯২"]) {
      expect(readLocalizedNumber(value, "bn")).toBeUndefined();
    }
    expect(readLocalizedNumber("১.২৫১", "bn", 2)).toBeUndefined();
    expect(readLocalizedNumber("١٫٢.٥", "ar", 2)).toBeUndefined();
  });

  it("keeps decimal precision and existing monetary values when editing with localized digits", () => {
    const values = [0, .001, .0000003212345678, 1234567.123456789, 1e24];
    for (const locale of ["bn", "bn-u-nu-latn", "fa", "fr", "en"]) {
      for (const value of values) expect(readLocalizedNumber(formatInputNumber(value, locale), locale, "any")).toBe(value);
    }
    expect(formatInputNumber(1234.5678, "bn")).toBe("১২৩৪.৫৬৭৮");
    expect(readLocalizedNumber("১২,৩৪৫.৬৭", "bn", "any")).toBeUndefined();
    expect(readLocalizedNumber("1e309", "en", "any")).toBeUndefined();
    expect(readLocalizedNumber("-৫", "bn", "any")).toBeUndefined();
  });

  it("reads both signed coordinates with localized decimals, including copied right-to-left signs", () => {
    expect(readCoordinatePair("\u200e−۲۱٫۴۲۲۵", "+۳۹٫۸۲۶۲", "fa")).toEqual({ lat: -21.4225, lon: 39.8262 });
    expect(readCoordinatePair("-২৩.৮১০৩", "০", "bn-u-nu-latn")).toEqual({ lat: -23.8103, lon: 0 });
    expect(readCoordinatePair("48,8566", "−2,3522", "fr")).toEqual({ lat: 48.8566, lon: -2.3522 });
    expect(readCoordinatePair("-90", "1.8e2", "en")).toEqual({ lat: -90, lon: 180 });
    for (const [lat, lon] of [["", "0"], ["0", ""], ["91", "0"], ["0", "-180.1"], ["1e309", "0"], ["0x10", "0"], ["--1", "0"]]) {
      expect(readCoordinatePair(lat, lon, "en")).toBeUndefined();
    }
  });
});

describe("Today summaries", () => {
  it("honors the digit setting and formats Hijri months and countdown units for the active locale", () => {
    const ms = 75 * 60_000;
    expect(duration(ms)).toBe("1h 15m");
    expect(duration(ms, "bn")).toBe("১ ঘণ্টা ১৫ মিনিট");
    expect(duration(ms, "bn-u-nu-latn")).toBe("1 ঘণ্টা 15 মিনিট");
    expect(duration(ms, "fr").replace(/\s/g, "")).toBe("1h15min");
    const afternoon = new Date("2026-11-19T11:12:00Z");
    expect(formatTime(afternoon, "Asia/Dhaka", "bn")).toBe("৫:১২ বিকাল");
    expect(formatTime(afternoon, "Asia/Dhaka", "bn-u-nu-latn")).toBe("5:12 বিকাল");
    expect(formatTime(afternoon, "Asia/Dhaka", "bn", true)).toBe("৫:১২");
    const day = baselineMonthStart(1448, 9);
    expect(hijriLabel(day, 0, [], "bn")).toBe("১ রমজান ১৪৪৮");
    expect(hijriLabel(day, 0, [], "bn-u-nu-latn")).toBe("1 রমজান 1448");
    expect(hijriLabel(day, 0, [], "ur")).toMatch(/\p{Script=Arabic}/u);
  });

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

  it("keeps regional week starts when the browser lacks locale week data", () => {
    class LocaleWithoutWeekInfo extends Intl.Locale {
      getWeekInfo = undefined;
      weekInfo = undefined;
    }
    vi.stubGlobal("Intl", Object.create(Intl, { Locale: { value: LocaleWithoutWeekInfo } }));
    try {
      expect(calendarWeekStart("en", "Asia/Dhaka", ["en-GB"])).toBe(0);
      expect(calendarWeekStart("en", "Europe/London", ["en-GB"])).toBe(1);
      expect(calendarWeekStart("en", "America/Toronto", ["en-CA"])).toBe(0);
      expect(calendarWeekStart("ur", "Asia/Karachi", [])).toBe(0);
      expect(calendarWeekStart("id", "Asia/Jakarta", ["id-ID"])).toBe(0);
      expect(calendarWeekStart("fa", "Asia/Tehran", ["fa-IR"])).toBe(6);
      expect(calendarWeekStart("en", "Indian/Maldives", ["en-MV"])).toBe(5);
    } finally { vi.unstubAllGlobals(); }
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
    expect(zakatMoney(result.net, "BDT", "bn", true).replace(/[৳\s]/g, "")).toBe("৭,৪৯,৯১২");
    expect(zakatMoney(result.net, "BDT", "bn-u-nu-latn", true).replace(/[৳\s]/g, "")).toBe("7,49,912");
    expect(zakatMoney(123_456.78, "BDT", "id", true).replace(/[^0-9.,]/g, "")).toBe("123.456,78");
    expect(zakatMoney(123_456.78, "IDR", "id", true)).toBe("Rp\u00a0123.456,78");
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

  it("round-trips localized time fields to saved HH:mm and validates the clock", () => {
    expect(mosqueInputClock("07:30", "bn")).toBe("০৭:৩০");
    expect(mosqueInputClock("07:30", "bn-u-nu-latn")).toBe("07:30");
    expect(mosqueInputClock("07:30", "id")).toBe("07.30");
    expect(mosqueInputClock("", "bn")).toBe("");
    expect(parseMosqueClock(" ৭:৩০ ", "bn")).toBe("07:30");
    expect(parseMosqueClock("৭৩০", "bn-u-nu-latn")).toBe("07:30");
    expect(parseMosqueClock("17.30", "id")).toBe("17:30");
    expect(parseMosqueClock("٠٠:٠٠", "fa")).toBe("00:00");
    expect(parseMosqueClock("२३५९", "hi-u-nu-deva")).toBe("23:59");
    for (const value of ["", "24:00", "12:60", "5:1", "05:17 PM", "12:30:00", "1e30"]) {
      expect(parseMosqueClock(value, "en")).toBeUndefined();
    }
    expect(latinDigits("+880 ١۲৩", "bn")).toBe("+880 123");
  });

  it("formats both fixed and adhan-relative jamaat times without changing mosque assignments", () => {
    const city = defaults.city;
    const date = "2026-11-20";
    const prayer = prayerDay(date, city, defaults.method, defaults.school, new Date(date)).find(item => item.id === "dhuhr");
    const plan = { ...mosqueDefaults, mosques: [home], mapping: { "5-dhuhr": home.id } };
    const copy = { locale: "bn", afterAdhan: "আজানের ৫ মিনিট পর" };
    expect(jamaatForPrayer(prayer, city.timeZone, plan, copy)).toEqual({ id: home.id, mosque: home.name, time: "১৩:১৫" });
    expect(jamaatForPrayer(prayer, city.timeZone, plan, { ...copy, locale: "bn-u-nu-latn" })?.time).toBe("13:15");
    const relative = { ...plan, mosques: [{ ...home, jumuah: undefined, jamaat: { dhuhr: "adhan+5" } }] };
    expect(jamaatForPrayer(prayer, city.timeZone, relative, copy)?.time).toMatch(/[০-৯]+:[০-৯]{2}/);
    expect(jamaatForPrayer({ ...prayer, starts: new Date(NaN) }, city.timeZone, relative, copy)?.time).toBe(copy.afterAdhan);
  });

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

describe("Haram gate memory", () => {
  const outline: HaramOutline = [[[-.001, -.001], [-.001, .001], [.001, .001], [.001, -.001], [-.001, -.001]]];
  const gates = [
    { id: "gate-1", point: { lat: -.001, lon: 0 } },
    { id: "gate-2", point: { lat: .001, lon: 0 } },
  ];
  const fix = (lat: number, at: number, lon = 0, accuracy = 6) => ({ point: { lat, lon }, at, accuracy });

  it("records entry and exit at different gates and waits for a clear boundary crossing", () => {
    let watch: GateWatch = {};
    watch = observeHaramGate(watch, fix(-.0014, 1000), outline, gates, undefined).watch;
    const threshold = observeHaramGate(watch, fix(-.001, 10_000), outline, gates, undefined);
    expect(threshold.memory).toBeUndefined();
    const entry = observeHaramGate(threshold.watch, fix(-.0008, 20_000), outline, gates, undefined);
    expect(entry.memory).toEqual({ entry: "gate-1" });
    expect(observeHaramGate(entry.watch, fix(.0012, 40_000), outline, gates, entry.memory).memory)
      .toEqual({ entry: "gate-1", exit: "gate-2" });
  });

  it("skips poor, ambiguous, and stale fixes", () => {
    const initial = observeHaramGate({}, fix(-.0014, 1000), outline, gates, undefined);
    const other = { id: "gate-3", point: { lat: -.001, lon: .00002 } };
    const uncertain = observeHaramGate(initial.watch, fix(-.001, 12_000), outline, [...gates, other], undefined);
    expect(uncertain.watch.gate).toBeUndefined();
    expect(observeHaramGate(initial.watch, fix(-.0008, 20_000, 0, 45), outline, gates, undefined)).toEqual(initial);
    const threshold = observeHaramGate(initial.watch, fix(-.001, 12_000), outline, gates, undefined);
    expect(observeHaramGate(threshold.watch, fix(-.0007, 100_000, .0005), outline, gates, undefined).memory).toBeUndefined();
  });
});

describe("offline map places", () => {
  const gate = { id: "gate-3210622327", title: "King Fahd Gate - 79", point: { lat: 21.421232, lon: 39.8240461 } };
  it("matches a real gate number in Latin, Bangla and Arabic digits without matching partial numbers", () => {
    for (const query of ["gate 79", "ফটক ৭৯", "٧٩", "Fahd ۷۹"]) {
      expect(mapPlaceMatches(gate, query, ["ফটক"])).toBe(true);
    }
    expect(mapPlaceMatches(gate, "7", ["ফটক"])).toBe(false);
    expect(mapPlaceMatches({ ...gate, title: "As-Salām Gate", number: "1" }, "salam 1", [])).toBe(true);
  });

  it("keeps hotel guidance local to the city with a recent nearby fix", () => {
    const nabawi = { lat: 24.4684, lon: 39.6111 };
    expect(placeRegion(gate.point)).toBe("makkah");
    expect(placeRegion(nabawi)).toBe("madinah");
    expect(nearbyMapPoint(nabawi, "makkah")).toBeUndefined();
    expect(nearbyMapPoint({ lat: 23.81, lon: 90.41 }, "madinah")).toBeUndefined();
    expect(nearbyMapPoint(gate.point, "makkah")).toBe(gate.point);
  });
});

describe("Umrah Now", () => {
  it("adds crowd time for Friday Dhuhr and keeps the other prayer walks on the saved buffer", () => {
    const trip = { ...initialTrip, walk: 9, crowd: 17, start: "2026-11-18", end: "2026-11-26" };
    const fajr = umrahContext(new Date("2026-11-20T01:31:00Z"), trip);
    const dhuhr = umrahContext(new Date("2026-11-20T08:01:00Z"), trip);
    const saturday = umrahContext(new Date("2026-11-21T08:01:00Z"), trip);
    expect(fajr.next.id).toBe("fajr");
    expect(fajr.next.starts.getTime() - fajr.leave.getTime()).toBe(26 * 60_000);
    expect(dhuhr.next.id).toBe("dhuhr");
    expect(dhuhr.next.starts.getTime() - dhuhr.leave.getTime()).toBe(36 * 60_000);
    expect(dhuhr.leave).toEqual(dhuhr.leaveForDhuhr);
    expect(saturday.next.starts.getTime() - saturday.leave.getTime()).toBe(26 * 60_000);
    expect(fajr.tripActive).toBe(true);
    expect(umrahContext(new Date("2026-11-26T21:00:00Z"), trip).tripActive).toBe(false);
  });

  it("uses the start of the next available last third across Makkah midnight", () => {
    const priorSunset = schedule("2026-11-19", makkah, "UmmAlQura", "shafi").maghrib;
    const context = umrahContext(new Date("2026-11-19T21:02:00Z"), initialTrip);
    const night = context.times.fajr.getTime() - priorSunset.getTime();
    const remaining = context.times.fajr.getTime() - context.tahajjud.getTime();
    expect(context.alarmDay).toBe("2026-11-20");
    expect(remaining).toBeLessThanOrEqual(night / 3);
    expect(remaining).toBeGreaterThan(night / 3 - 60_000);
    const afterAlarm = umrahContext(new Date(context.tahajjud.getTime() + 1000), initialTrip);
    expect(afterAlarm.alarmDay).toBe("2026-11-21");
    expect(afterAlarm.tahajjud.getTime()).toBeGreaterThan(context.tahajjud.getTime());
  });
});

describe("Haram focus", () => {
  it("toggles only the selected request for the selected Makkah day", () => {
    const past = "2026-11-19";
    const today = "2026-11-20";
    const other = { id: "b", name: "B", for: "Health", done: [] };
    const original = [{ id: "a", name: "A", for: "Family", done: [past] }, other];
    const marked = toggleUmrahDua(original, "a", today);
    expect(marked[0].done).toEqual([past, today]);
    expect(marked[1]).toBe(other);
    expect(toggleUmrahDua(marked, "a", today)).toEqual(original);
  });

  it("bounds corrections between zero and seven rounds", () => {
    expect(tawafRounds(0, -1)).toBe(0);
    expect(tawafRounds(6, 1)).toBe(7);
    expect(tawafRounds(7, 1)).toBe(7);
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
    const arrived = advanceSai(left, "marwah", 80_000, 400);
    expect(arrived).toMatchObject({ count: 1, last: "marwah", exited: false, detected: true });
    expect(correctSai(arrived, 0, 81_000)).not.toHaveProperty("detected");
  });

  it("caps manual and automatic counts and preserves the expected alternating end", () => {
    const corrected = correctSai(initialSai, 9, 1000);
    expect(corrected).toMatchObject({ count: 7, last: "marwah" });
    expect(advanceSai(corrected, "safa", 80_000, 400)).toBe(corrected);
  });

  it("alternates each lap from Ṣafā and finishes the seventh at Marwah", () => {
    expect(Array.from({ length: 7 }, (_, index) => saiLapEnds(index + 1).to))
      .toEqual(["marwah", "safa", "marwah", "safa", "marwah", "safa", "marwah"]);
  });

  it("shows a schematic position along the walkway and omits fixes away from either end or the corridor", () => {
    const course = { safa: { lat: 0, lon: 0 }, marwah: { lat: .004, lon: 0 } };
    const point = { lat: .001, lon: 0 };
    const towardMarwah = saiGuidePosition(course, point, "marwah");
    expect(towardMarwah?.fraction).toBeCloseTo(.25);
    expect(towardMarwah?.meters).toBeCloseTo(333.58, 1);
    expect(saiGuidePosition(course, point, "safa")?.meters).toBeCloseTo(111.19, 1);
    expect(saiGuidePosition(course, { lat: .002, lon: .001 }, "marwah")).toBeUndefined();
    expect(saiGuidePosition(course, { lat: .005, lon: 0 }, "safa")).toBeUndefined();
  });

  it("calculates hotel distance and bearing without a network", () => {
    expect(distance({ lat: 0, lon: 0 }, { lat: 0, lon: .01 })).toBeCloseTo(1111.95, 1);
    expect(bearing({ lat: 0, lon: 0 }, { lat: 0, lon: .01 })).toBe(90);
  });
});

describe("Umrah trip transfer", () => {
  it("transfers trip details and preparation without live tracking state", () => {
    const plan = readUmrahTripFile(exportUmrahTrip({ ...initialTrip, start: "2027-02-02", end: "2027-02-10", gps: true, auto: true, tawaf: 5,
      hotel: { name: "Hotel", room: "12", point: { lat: 21.4, lon: 39.8 } },
      preparation: { ...emptyPreparation, hotelArabic: "الفندق", completed: ["ihram"] } }));
    expect(plan).toMatchObject({ start: "2027-02-02", hotel: { name: "Hotel", point: { lat: 21.4, lon: 39.8 } },
      preparation: { hotelArabic: "الفندق", completed: ["ihram"] } });
    expect(plan).not.toHaveProperty("gps");
    expect(plan).not.toHaveProperty("auto");
    expect(plan).not.toHaveProperty("tawaf");
    expect(tripDates({ ...initialTrip, ...plan }, "en")).toMatch(/^2.*10 Feb 2027$/);
  });

  it("accepts trips with no preparation fields and rejects invalid trip files", () => {
    const original = JSON.parse(exportUmrahTrip(initialTrip));
    expect(readUmrahTripFile(JSON.stringify(original)).preparation).toBeUndefined();
    expect(() => readUmrahTripFile(JSON.stringify({ ...original, awwabUmrahTrip: 2 }))).toThrow();
    expect(() => readUmrahTripFile(JSON.stringify({ ...original, trip: { ...original.trip, start: "2027-02-28", end: "2027-02-02" } }))).toThrow();
  });
});

describe("Ask in Arabic", () => {
  it("renders every phrase in English and Bangla, with English fallback for an absent locale", () => {
    expect(umrahPhrases).toHaveLength(63);
    const english = message.bind(null, defaults);
    const bangla = message.bind(null, { ...defaults, language: "bn" });
    const fallback = message.bind(null, { ...defaults, language: "fr" });
    for (const phrase of umrahPhrases) {
      expect(askMeaning(phrase, english)).toBe(renderAsk(phrase, "saudi").en);
      expect(askMeaning(phrase, fallback)).toBe(askMeaning(phrase, english));
      expect(askMeaning(phrase, bangla)).toMatch(/\p{Script=Bengali}/u);
    }
  });

  it("uses translated destination and family labels and respects the Bangla numeral setting", () => {
    const bangla = message.bind(null, { ...defaults, language: "bn" });
    const latin = message.bind(null, { ...defaults, language: "bn", nativeDigits: false });
    const gate = askPhrase("gate-number");
    expect(askMeaning(gate, bangla, { gate: 300 })).toBe("৩০০ নম্বর ফটক কোথায়?");
    expect(askMeaning(gate, latin, { gate: 300 })).toBe("300 নম্বর ফটক কোথায়?");
    expect(askMeaning(askPhrase("bus-to"), bangla, { place: "airport" })).toBe("বিমানবন্দর যাওয়ার বাস কোথায়?");
    expect(askMeaning(askPhrase("lost-family"), bangla, { relation: "daughter" })).toBe("আমি আমার মেয়েকে খুঁজে পাচ্ছি না");
  });

  it("finds translated phrases as well as the English text and Arabic variants", () => {
    const toilet = askPhrase("toilet");
    const translated = "ٹوائلٹ کہاں ہے؟";
    expect(askPhraseMatches(toilet, "ٹوائلٹ", translated)).toBe(true);
    expect(askPhraseMatches(toilet, "toilet", translated)).toBe(true);
    expect(askPhraseMatches(toilet, "الحمام", translated)).toBe(true);
    expect(askPhraseMatches(toilet, "taxi", translated)).toBe(false);
  });

  it("uses trip context and always includes the lost phrase", () => {
    expect(quickAsks("In the Haram").map(phrase => phrase.id)).toEqual(["toilet", "wudu", "zamzam", "women-prayer", "gate-number", "lost"]);
    expect(quickAsks("At the hotel").map(phrase => phrase.id)).toContain("wifi");
    expect(quickAsks("Eating out").map(phrase => phrase.id)).toContain("not-spicy");
  });

  it("parses localized gate digits and displays Arabic-Indic digits in both varieties", () => {
    for (const input of ["79", "٧٩", "۷۹", "৭৯"]) expect(readGate(input)).toBe(79);
    for (const input of ["0", "301", "79.5", "abc", ""]) expect(readGate(input)).toBeUndefined();
    expect(renderAsk(askPhrase("gate-number"), "saudi", { gate: 300 }).ar).toBe("فين باب رقم ٣٠٠؟");
    expect(renderAsk(askPhrase("gate-number"), "msa", { gate: 1 }).ar).toBe("أين الباب رقم ١؟");
  });

  it("fills family and gender forms without changing the default catalog", () => {
    expect(renderAsk(askPhrase("lost-family"), "saudi", { relation: "mother" }).ar).toBe("ضاعت أمي");
    expect(renderAsk(askPhrase("lost-family"), "saudi", { relation: "father" }).ar).toBe("ضاع أبوي");
    expect(renderAsk(askPhrase("excuse-me"), "saudi", { toFemale: true }).ar).toBe("لو سمحتي");
    expect(renderAsk(askPhrase("lost"), "msa", { speaker: "female" }).ar).toBe("أنا تائهة");
  });
});
