import { useMemo } from "react";
import { message } from "@/lib/copy";
import { addDays, dateKey } from "@/lib/dates";
import { calendarDefaults, hijriOn, monthStart } from "@/lib/hijri";
import { formatLocale, type AppLanguage } from "@/lib/languagePreferences";
import { coreWordCoverage, coreWordTotal, countKnownQuranWords, quranText } from "@/lib/quran";
import type { Reviews } from "@/lib/reviews";
import type { ShareCard, TemplateId } from "@/lib/share";
import { prayerStatistics, type Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import type { WordMilestone } from "@/lib/studyMilestones";
import { initialTrip } from "@/lib/umrah";
import { usePrayerLogs, useRecord } from "./use-awwab";
import alphabet from "../../docs/content/arabic-letters.json";
import lessons from "../../docs/content/qaida-lessons.json";
import chapters from "../../docs/content/surahs-for-salah.json";
import returnCopy from "../../docs/content/return.json";
import umrahCopy from "../../docs/content/umrah-duas.json";

export const shareChapters = chapters.surahs.slice(0, 12);
const examples = [
  { arabic: "ٱللَّه", key: "cardWordAllah" }, { arabic: "رَبّ", key: "cardWordLord" }, { arabic: "قَالَ", key: "cardWordSaid" },
  { arabic: "يَوْم", key: "cardWordDay" }, { arabic: "كِتَاب", key: "cardWordBook" }, { arabic: "عِلْم", key: "cardWordKnowledge" },
  { arabic: "ٱلنَّاس", key: "cardWordPeople" }, { arabic: "أَرْض", key: "cardWordEarth" }, { arabic: "سَمَاء", key: "cardWordSky" },
];
const dayDistance = (later: string, earlier: string) => (Date.parse(later) - Date.parse(earlier)) / 86_400_000;

export function useShareCards(settings: Settings, now: Date, template?: TemplateId, value?: number, language: AppLanguage = settings.language) {
  const { mode, hijriAdjust, spellStyle, nativeDigits, wordChoices } = settings;
  const logs = usePrayerLogs();
  const day = dateKey(now, settings.city.timeZone);
  const makkahDay = dateKey(now, "Asia/Riyadh");
  const reviews = useRecord<Reviews>("reviews", {});
  const completed = useRecord<number[]>("qaida-complete", []);
  const known = useRecord<string[]>("word-bank-known", []);
  const earned = useRecord<WordMilestone[]>("word-milestones", []);
  const knownVerses = useRecord<string[]>("words-known", []);
  const calendar = useRecord("calendar", calendarDefaults);
  const trip = useRecord("umrah", initialTrip);

  return useMemo(() => {
    const copy = { mode, language, nativeDigits, wordChoices };
    const t = message.bind(null, copy);
    const number = new Intl.NumberFormat(formatLocale(copy));
    const tagline = t("cardFooterTagline");
    const englishCitation = (source: string) => language === "en" ? source : `${source} · ${t("cardEnglishMeaning")}`;
    const solid = shareChapters.filter(surah => reviews[surah.number]?.bucket === "manzil");
    const chapter = (template === "surah" && shareChapters.find(item => item.number === value)) || solid.at(-1) || shareChapters.find(item => item.number === 103);
    const mastered = solid.some(surah => surah.number === chapter.number);
    const verses = quranText[chapter.number].slice(0, chapter.number === 103 ? 3 : 1);
    const title = studyNames.surah(language, chapter.number, chapter.number === 103 ? "Al-ʿAsr" : chapter.transliteration);
    const ayahNumber = (ref: string) => number.format(Number(ref.split(":")[1]));
    const reference = `${number.format(chapter.number)}:${ayahNumber(verses[0].ref)}${verses.length > 1 ? `–${ayahNumber(verses.at(-1).ref)}` : ""}`;
    const words = template === "words" && earned.includes(value as WordMilestone) ? value : countKnownQuranWords(knownVerses, known);
    const selectedLesson = (template === "qaida" && lessons.lessons.find(item => item.n === value)) || lessons.lessons.find(item => item.n === completed.at(-1)) || lessons.lessons[3];
    const complete = lessons.lessons.filter(lesson => completed.includes(lesson.n)).length;
    const hijri = hijriOn(day, hijriAdjust, calendar.anchors);
    const yearStart = monthStart(hijri.year, 1, hijriAdjust, calendar.anchors).date;
    const yearEnd = monthStart(hijri.year + 1, 1, hijriAdjust, calendar.anchors).date;
    const thisYear = logs.filter(log => log.date >= yearStart && log.date <= day);
    const activity = new Set(thisYear.map(item => item.date));
    const stats = prayerStatistics(thisYear, day);
    const duringTrip = trip.start && trip.end && trip.start <= makkahDay && makkahDay <= trip.end;
    const ampara = spellStyle === "ampara-bn";
    const tiles = [
      { arabic: "بَ", label: "Bāʾ", mark: ampara ? "zabar" : "fatha", ink: "fatha", dot: "share-zabar-dot", sound: "ba" },
      { arabic: "بِ", label: "Bāʾ", mark: ampara ? "zer" : "kasra", ink: "kasra", dot: "share-zer-dot", sound: "bi" },
      { arabic: "بُ", label: "Bāʾ", mark: ampara ? "pesh" : "ḍamma", ink: "damma", dot: "share-pesh-dot", sound: "bu" },
    ];
    return {
      surah: {
        tagline,
        badge: t(mastered ? "cardLearnedBadge" : "cardPracticeBadge"), title,
        detail: t(mastered ? "cardSurahDetail" : "cardSurahPractice", { number: chapter.number }), arabic: verses[0].uthmani,
        meaning: verses.map(verse => verse.english).join(" "),
        reference, citation: englishCitation(`${reference} · M. M. Pickthall`),
        progress: { value: solid.length, total: shareChapters.length, label: t("cardSurahCount", { count: solid.length, total: shareChapters.length }) },
      },
      words: {
        tagline,
        badge: t("cardQuranWords"), title: number.format(words), detail: t(words ? "cardWordsDetail" : "cardWordExamples"),
        tiles: examples.map(({ arabic, key }) => ({ arabic, label: t(key) })),
        note: t("cardWordsCoverage", { total: coreWordTotal, coverage: coreWordCoverage }),
      },
      return: {
        tagline,
        badge: t("cardReturningYear", { year: hijri.year }), title: t("cardReturnTitle"), detail: t("cardReturnDetail"),
        activity: Array.from({ length: Math.min(371, dayDistance(yearEnd, yearStart)) }, (_, i) => Number(activity.has(addDays(yearStart, i)))),
        note: t("cardReturnHeatmap"), arabic: returnCopy.welcome.arabic, meaning: returnCopy.welcome.meaning, citation: englishCitation("17:25"),
        numbers: { title: t("cardReturnNumber", { count: stats.returns }), label: t("cardPrayerCount", { count: thisYear.length }) },
      },
      qaida: {
        tagline,
        badge: t("cardQaidaBadge"), title: t("cardQaidaTitle", { number: selectedLesson.n, total: lessons.lessons.length }),
        detail: selectedLesson.n === 4 ? t(ampara ? "cardQaidaZabar" : "cardQaidaFatha") : studyNames.lesson(language, selectedLesson.n, selectedLesson.title), tiles,
        progress: { value: complete, total: lessons.lessons.length, label: t("cardQaidaCount", { count: complete, total: lessons.lessons.length }) },
      },
      umrah: {
        tagline,
        badge: t("umrah"), title: duringTrip ? t("cardUmrahDay", { day: dayDistance(makkahDay, trip.start) + 1, total: dayDistance(trip.end, trip.start) + 1 }) : t("shareUmrah"),
        detail: t("cardUmrahTitle"), note: t("cardUmrahNote"), arabic: umrahCopy.talbiyah.arabic.split("\n")[0],
        meaning: "Here I am, O Allah, here I am.", citation: englishCitation(umrahCopy.talbiyah.source),
      },
      maktab: {
        tagline,
        badge: t(complete === lessons.lessons.length ? "cardMaktabBadge" : "shareMaktab"),
        title: t(complete === lessons.lessons.length ? "cardMaktabTitle" : "cardMaktabPractice"), detail: t("cardMaktabDetail"),
        tiles: alphabet.letters.map(item => ({ arabic: item.letter })),
      },
    } satisfies Record<TemplateId, ShareCard>;
  }, [logs, day, makkahDay, reviews, completed, known, knownVerses, earned, calendar, trip.start, trip.end, mode, language, nativeDigits, wordChoices, template, value, hijriAdjust, spellStyle]);
}
