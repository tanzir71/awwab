import Dexie, { type EntityTable, type Table } from "dexie";
import { z } from "zod";
import { prayerIds, type PrayerLog, type Prayer, type PrayerId } from "../types/Prayer";
import { addDays, dateKey } from "./dates";
import { cities, methodNames, type AsrSchool, type City, type PrayerMethod } from "./prayerServices";
import { guideReferences, type GuideReference } from "./prayerGuide";
import { deskActivities } from "./studyDesk";
import type { MosquePlan } from "./mosques";
import { zakatBalances } from "./zakat";
import { emptyPreparation, tripChecklist, type UmrahTrip } from "./umrah";
import { askVarieties, askVoices } from "./umrahAsk";
import { builtInLanguages, glossaryOptions, glossaryTerms, textSizes, type AppLanguage, type GlossaryTerm, type WordChoices } from "./languagePreferences";

export interface Settings {
  mode: "adult" | "maktab";
  script: "indopak" | "uthmani";
  school: AsrSchool;
  prayerGuide?: GuideReference;
  method: PrayerMethod;
  city: City;
  hijriAdjust: number;
  spellStyle: "en" | "ampara-bn";
  language: AppLanguage;
  nativeDigits?: boolean;
  quranMeanings?: boolean;
  englishMeaning?: boolean;
  textSize?: typeof textSizes[number];
  wordChoices?: WordChoices;
  onboarded: boolean;
}

export const defaults: Settings = {
  mode: "adult", script: "indopak", school: "hanafi", method: "Karachi", city: cities[0],
  hijriAdjust: 0, spellStyle: "en", language: "en", onboarded: false,
};

export interface LocalRecord {
  key: string;
  value: unknown;
}

export interface LocalAudio {
  ref: string;
  blob: Blob;
  title: string;
  attribution?: string;
}

export function openDatabase(name = "awwab") {
  const database = new Dexie(name) as Dexie & {
    records: EntityTable<LocalRecord, "key">;
    prayers: Table<PrayerLog, [string, PrayerId]>;
    audio: EntityTable<LocalAudio, "ref">;
  };
  database.version(1).stores({ records: "&key", prayers: "[date+prayer], date" });
  database.version(2).stores({ audio: "&ref" });
  return database;
}

export const db = openDatabase();

export async function getRecord<T>(key: string, fallback: T): Promise<T> {
  const record = await db.records.get(key);
  return (record?.value as T) ?? fallback;
}

export function updateRecord<T>(key: string, fallback: T, update: (current: T) => T) {
  return db.transaction("rw", db.records, async () => {
    const value = update(await getRecord(key, fallback));
    await db.records.put({ key, value });
  });
}

export function updateSettings(patch: Partial<Settings>) {
  return updateRecord("settings", defaults, saved => ({ ...defaults, ...saved, ...patch }));
}

export function updateWordChoice(language: AppLanguage, term?: GlossaryTerm, choice?: string) {
  return updateRecord("settings", defaults, saved => {
    const wordChoices = { ...saved.wordChoices };
    if (term && glossaryOptions(language, term).includes(choice)) wordChoices[language] = { ...wordChoices[language], [term]: choice };
    if (!term) delete wordChoices[language];
    return { ...defaults, ...saved, wordChoices };
  });
}

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(day => {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === day;
});
const instantSchema = z.string().datetime();
const prayerSchema = z.object({
  date: daySchema,
  prayer: z.enum(prayerIds),
  status: z.enum(["done", "late", "qada"]),
  at: instantSchema,
  mosqueId: z.string().optional(),
});
const citySchema = z.object({
  name: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timeZone: z.string().refine(zone => {
    try { dateKey(new Date(), zone); return true; } catch { return false; }
  }),
});
const settingsSchema = z.object({
  mode: z.enum(["adult", "maktab"]),
  script: z.enum(["indopak", "uthmani"]),
  school: z.enum(["hanafi", "shafi"]),
  prayerGuide: z.enum(guideReferences).optional(),
  method: z.custom<PrayerMethod>(value => typeof value === "string" && Object.prototype.hasOwnProperty.call(methodNames, value)),
  city: citySchema,
  hijriAdjust: z.number().int().min(-2).max(2),
  spellStyle: z.enum(["en", "ampara-bn"]),
  language: z.enum(builtInLanguages),
  nativeDigits: z.boolean().optional(),
  quranMeanings: z.boolean().optional(),
  englishMeaning: z.boolean().optional(),
  textSize: z.enum(textSizes).optional(),
  wordChoices: z.partialRecord(z.enum(builtInLanguages), z.partialRecord(z.enum(glossaryTerms), z.string().max(80))).optional(),
  onboarded: z.boolean(),
});
const legacySchema = z.array(z.object({ date: daySchema, prayerName: z.string(), completedAt: instantSchema }));
const count = z.number().int().nonnegative();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const labels = z.array(z.string().max(500));
const dateCounts = z.record(daySchema, count);
const dateLists = z.record(daySchema, labels);
const balances = z.object({ fajr: count, dhuhr: count, asr: count, maghrib: count, isha: count });
const reviewSchema = z.object({
  bucket: z.enum(["sabaq", "sabqi", "manzil"]), attempts: count.optional(), correct: count.optional(),
  firstTries: z.record(daySchema, z.boolean()).optional(),
  card: z.object({ due: instantSchema, last_review: instantSchema.optional() }).passthrough(),
});
const passageKey = z.string().regex(/^[a-z0-9-]+$/).max(80);
const umrahPlanSchema = z.object({
  start: z.union([daySchema, z.literal("")]), end: z.union([daySchema, z.literal("")]),
  hotel: z.object({ name: z.string().max(120), room: z.string().max(25), point: point.optional() }),
  group: z.string().max(120), meeting: point.optional(), gate: z.string().max(120),
  walk: count.max(120), crowd: count.max(90), iqamah: count.max(90),
  preparation: z.object({
    hotelArabic: z.string().max(120), hotelAddress: z.string().max(240), leader: z.string().max(120), phone: z.string().max(30),
    makkahNights: count.max(90).optional(), madinahNights: count.max(90).optional(), completed: z.array(z.enum(tripChecklist)).max(tripChecklist.length),
  }).optional(),
  requests: z.array(z.object({ id: z.string(), name: z.string().max(100), for: z.string().max(500), done: z.array(daySchema) })),
});
const umrahFileSchema = z.object({ awwabUmrahTrip: z.literal(1), trip: umrahPlanSchema.refine(trip => trip.end >= trip.start) });

export function exportUmrahTrip(trip: UmrahTrip) {
  return JSON.stringify({ awwabUmrahTrip: 1, trip: umrahPlanSchema.parse(trip) }, null, 2);
}

export function readUmrahTripFile(text: string) {
  const { trip } = umrahFileSchema.parse(JSON.parse(text));
  return { ...trip, start: trip.start, end: trip.end, meeting: trip.meeting, hotel: { ...trip.hotel, point: trip.hotel.point },
    preparation: trip.preparation ? { ...emptyPreparation, ...trip.preparation } : undefined };
}

const savedRecords: Record<string, z.ZodTypeAny> = {
  "hifz-plans": z.record(passageKey, z.object({ minutes: count.min(1).max(90), start: daySchema })),
  "hifz-current": passageKey,
  "path-placement": z.partialRecord(z.enum(["read", "memorise", "understand", "speak"]), z.object({ level: count.min(1).max(5), score: count, total: count, day: daySchema })),
  "hifz-portions": z.record(z.string().regex(/^\d{1,3}:\d{1,3}-\d{1,3}:\d{1,3}$/), z.object({
    review: reviewSchema, correctDays: z.array(daySchema).max(3), lastDay: daySchema, learnedOn: daySchema.optional(),
  })),
  "umrah-ask-settings": z.object({ variety: z.enum(askVarieties), voice: z.enum(askVoices), speaker: z.union([z.enum(askVoices), z.literal("")]), slow: z.boolean() }),
  "umrah-ask-volume-hint": z.boolean(),
  "umrah-custom-phrases": z.array(z.object({ id: z.string().uuid(), ar: z.string().trim().min(1).max(280), meaning: z.string().trim().min(1).max(280) })),
  settings: settingsSchema,
  "wording-suggestions": z.array(z.object({ language: z.enum(builtInLanguages), page: z.string().max(160), original: z.string().max(500), proposed: z.string().max(500) })).max(300),
  "qaida-current": count.min(1).max(17),
  "qaida-complete": z.array(count.min(1).max(17)),
  "study-days": z.array(daySchema),
  "study-plan-hidden": z.array(z.enum(deskActivities)),
  "surah-lines-known": z.array(z.string().regex(/^\d{1,3}:\d{1,3}$/)),
  "sayyid-line": count.max(6),
  "sayyid-reviewed": z.array(count.max(6)),
  "words-known": labels,
  "takhti-practised": labels,
  "word-bank-known": labels,
  "word-milestones": z.array(z.union([z.literal(25), z.literal(50), z.literal(100), z.literal(125)])),
  istighfar: dateCounts,
  qada: z.object({ estimated: balances, madeUp: balances, dailyGoal: count.min(1).max(100), withEachPrayer: z.boolean().optional(),
    fasts: count, fastsMadeUp: count, manualDays: z.record(daySchema, z.partialRecord(z.enum(prayerIds), count)).optional() }),
  calendar: z.object({
    anchors: z.array(z.object({ year: count.min(1), month: count.min(1).max(12), date: daySchema, source: z.string().max(100) })),
    overrides: z.record(z.string(), z.object({ date: daySchema.optional(), source: z.string().max(100).optional(), adjust: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })),
    sightingSource: z.string().max(100).optional(),
    moonReminders: z.record(z.string(), z.boolean()).optional(),
  }),
  mosques: z.object({
    mosques: z.array(z.object({
      id: z.string().max(128),
      name: z.string().min(1).max(100),
      role: z.enum(["home", "office", "jumuah", "eid", "hometown", "other"]),
      source: z.enum(["board photo", "imam", "friend", "visited"]),
      updatedAt: instantSchema,
      jamaat: z.partialRecord(z.enum(prayerIds), z.union([time, z.literal("adhan+5")])),
      jumuah: z.object({ khutbah: z.union([time, z.literal("")]), prayer: z.union([time, z.literal("")]) }).optional(),
      occasional: z.array(z.object({ type: z.enum(["eid_fitr", "eid_adha", "tarawih"]), year: count.min(1900).max(2200), times: z.array(time) })),
      photo: z.string().max(2_700_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/).optional(),
      photoSavedAt: instantSchema.optional(),
      refreshMonth: count.min(1).max(12).optional(),
      contact: z.string().regex(/^\d*$/).max(30).optional(),
      location: point.optional(),
    })),
    mapping: z.record(z.string(), z.string().max(128)),
  }),
  zakat: z.object({
    basis: z.enum(["silver", "gold"]), unit: z.enum(["g", "bhori"]),
    price: z.number().finite().nonnegative(), cash: z.number().finite().nonnegative(), metals: z.number().finite().nonnegative(),
    trade: z.number().finite().nonnegative(), debt: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/),
    hawlMonth: count.min(1).max(12), hawlDay: count.min(1).max(30),
    hawlSet: z.boolean().optional(), receivables: z.number().finite().nonnegative().optional(),
    prices: z.partialRecord(z.enum(["gold", "silver"]), z.number().finite().nonnegative()).optional(),
    assets: z.array(z.union([
      z.object({ id: z.string().max(128), name: z.string().max(100), kind: z.enum(zakatBalances), amount: z.number().finite().nonnegative() }),
      z.object({ id: z.string().max(128), name: z.string().max(100), kind: z.literal("metal"),
        basis: z.enum(["gold", "silver"]), weight: z.number().finite().positive(),
        unit: z.enum(["g", "bhori"]), purity: z.number().finite().positive().max(100) }),
    ])).optional(),
    payments: z.array(z.object({ day: daySchema, amount: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/),
      hawlYear: count.min(1).optional(), name: z.string().max(100).optional() })),
  }),
  umrah: umrahPlanSchema.extend({
    state: z.enum(["At the hotel", "Walking", "In the Haram", "Doing Umrah", "Resting", "Eating out"]),
    gps: z.boolean(), auto: z.boolean(),
    tawaf: count.max(7), step: count.max(6),
    sai: z.object({ count: count.max(7), last: z.enum(["safa", "marwah"]).optional(), lastAt: count.optional(), exited: z.boolean() }),
    dhikr: dateCounts, juz: dateCounts, haramPrayers: dateLists,
  }),
  reviews: z.record(z.string(), reviewSchema),
};

export async function migrateLegacy(storage: Pick<Storage, "getItem" | "removeItem">) {
  const raw = storage.getItem("completedPrayers");
  if (raw === null) return;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return; }
  const parsed = legacySchema.safeParse(value);
  if (!parsed.success) return;
  await db.transaction("rw", db.prayers, async () => {
    for (const log of parsed.data) {
      const prayer = prayerIds.find(id => id === log.prayerName.toLowerCase());
      if (prayer && !await db.prayers.get([log.date, prayer])) {
        await db.prayers.put({ date: log.date, prayer, status: "done", at: log.completedAt });
      }
    }
  });
  storage.removeItem("completedPrayers");
  storage.removeItem("lastActiveDay");
}

export async function logPrayer(prayer: Prayer, now = new Date(), mosqueId?: string) {
  if (now < prayer.starts || !Number.isFinite(prayer.starts.valueOf())) return;
  const status = now < prayer.ends ? "done" : "qada";
  await db.transaction("rw", db.prayers, async () => {
    if (!await db.prayers.get([prayer.date, prayer.id])) {
      await db.prayers.put({ date: prayer.date, prayer: prayer.id, status, at: now.toISOString(), mosqueId });
    }
  });
}

const backupSchema = z.object({
  app: z.literal("awwab"), version: z.literal(1),
  records: z.array(z.object({ key: z.string().min(1).max(256), value: z.unknown() })),
  prayers: z.array(prayerSchema),
  audio: z.array(z.object({
    ref: z.string().min(1).max(80),
    title: z.string().max(256),
    attribution: z.string().max(1000).optional(),
    type: z.string().regex(/^audio\/[\w.+-]+$/i),
    bytes: z.string().max(16_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/),
  })).optional(),
});

async function encodeBlob(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary);
}

function decodeBlob(bytes: string, type: string) {
  return new Blob([Uint8Array.from(atob(bytes), char => char.charCodeAt(0))], { type });
}

export async function backup() {
  const [records, prayers, clips] = await db.transaction("r", db.records, db.prayers, db.audio, () =>
    Promise.all([db.records.toArray(), db.prayers.toArray(), db.audio.toArray()]));
  const exported = await Promise.all(records.map(async record => {
    if (record.key !== "mosques") return record;
    const plan = record.value as MosquePlan;
    const mosques = await Promise.all(plan.mosques.map(async mosque => ({
      ...mosque, photo: mosque.photo instanceof Blob ? `data:${mosque.photo.type};base64,${await encodeBlob(mosque.photo)}` : mosque.photo,
    })));
    return { ...record, value: { ...plan, mosques } };
  }));
  const audio = await Promise.all(clips.map(async ({ blob, ...clip }) => ({ ...clip, type: blob.type, bytes: await encodeBlob(blob) })));
  return JSON.stringify({ app: "awwab", version: 1, records: exported, prayers, audio }, null, 2);
}

export async function restoreBackup(file: string, options?: { completeOnboarding?: boolean }) {
  const data = backupSchema.parse(JSON.parse(file));
  const records = data.records.map(({ key, value }) => {
    if (key === "mosques") {
      const plan = savedRecords.mosques.parse(value) as MosquePlan;
      const mosques = plan.mosques.map(mosque => {
        if (typeof mosque.photo !== "string") return mosque;
        const [header, bytes] = mosque.photo.split(",", 2);
        return { ...mosque, photo: decodeBlob(bytes, header.slice(5, -7)) };
      });
      return { key, value: { ...plan, mosques } };
    }
    if (key === "umrah") {
      const trip = savedRecords.umrah.parse(value) as Record<string, unknown>;
      return { key, value: { ...trip, gps: false, auto: false } };
    }
    return {
      key,
      value: /^qaida-row-\d{1,2}$/.test(key) ? count.max(100).parse(value) : savedRecords[key]?.parse(value) ?? value,
    };
  });
  const audio = (data.audio ?? []).map(({ bytes, type, ...clip }) => ({
    ref: clip.ref,
    title: clip.title,
    attribution: clip.attribution,
    blob: decodeBlob(bytes, type),
  }));
  await db.transaction("rw", db.records, db.prayers, db.audio, async () => {
    await db.records.clear();
    await db.prayers.clear();
    await db.audio.clear();
    await db.records.bulkPut(records);
    await db.prayers.bulkPut(data.prayers as PrayerLog[]);
    await db.audio.bulkPut(audio);
    if (options?.completeOnboarding) await updateSettings({ onboarded: true });
  });
}

export function prayerStatistics(logs: PrayerLog[], today: string) {
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.date <= today) counts.set(log.date, (counts.get(log.date) ?? 0) + 1);
  }
  const activeDays = [...counts.keys()].sort();
  const returnDays = activeDays.filter((day, i) => i > 0 && addDays(activeDays[i - 1], 1) < day);
  const recent = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29);
    return { day, count: counts.get(day) ?? 0 };
  });
  const consistency = Math.round(recent.reduce((sum, day) => sum + day.count, 0) * 100 / 150);
  return { consistency, recent, returns: returnDays.length, returnDays, activeDays: activeDays.length };
}
