import { useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { Wordmark } from "@/components/DesignIcon";
import { ListLink, SectionNav } from "@/components/Surface";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, hijriOn, monthStart } from "@/lib/hijri";
import { assignedMosque, mosqueAdhanOffset, mosqueDefaults, mosqueTime, mosqueWeekday } from "@/lib/mosques";
import { mosqueRoleLabel } from "@/lib/mosque-copy";
import { planMonth } from "@/lib/plan-copy";
import { prayerCityLabel } from "@/lib/settings-copy";
import { schedule } from "@/lib/prayerServices";
import { qadaBalances, qadaDefaults } from "@/lib/qada";
import { families, letterForms, lettersForFamily } from "@/lib/takhti";
import { initialZakat, metalLabels, zakatMoney, zakatProfileTotals, zakatSources } from "@/lib/zakat";
import { studyNames } from "@/lib/study-copy";
import { showEnglishQuranMeaning } from "@/lib/languagePreferences";
import type { Settings } from "@/lib/storageService";
import { prayerIds } from "@/types/Prayer";
import { quranText } from "@/lib/quran";
import { splitArabicWords, wordAnatomy } from "@/lib/wordAnatomy";
import surahs from "../../docs/content/surahs-for-salah.json";
import ritual from "../../docs/content/umrah-steps.json";
import cardTransliteration from "../../docs/content/print-surah-transliteration.json";
import { UmrahRitualDua, UmrahRitualSources } from "@/components/UmrahRitualContent";
import { umrahStepSummary, umrahStepTitle } from "@/lib/umrah-step-messages.mjs";

const sheets = [
  { to: "timetable", title: "printTimetable", detail: "printTimetableDetail" },
  { to: "ramadan", title: "printRamadan", detail: "printRamadanDetail" },
  { to: "takhti/boat", title: "printTakhti", detail: "printTakhtiDetail" },
  { to: "surah-cards", title: "printSurahCards", detail: "printSurahCardsDetail" },
  { to: "umrah-guide", title: "umrahPracticePocket", detail: "umrahPracticePocketDetail" },
  { to: "qada-sheet", title: "printQada", detail: "printQadaDetail" },
  { to: "zakat-summary", title: "printZakat", detail: "printZakatDetail" },
];

const printSurahs = surahs.surahs.slice(0, 12);
const pocketSet = [108, 103, 112, 106];

function verseLines(text: string) {
  const words = text.split(/\s+/);
  return Array.from({ length: Math.ceil(words.length / 4) }, (_, i) => words.slice(i * 4, i * 4 + 4).join(" ")).join("\n");
}

async function printPaper() {
  await document.fonts.ready;
  window.print();
}

export function PrintHub() {
  const { t } = useCopy();
  return <div className="stack">
    <SectionNav title={t("print")} back="/plan" />
    {sheets.map(item => <ListLink key={item.to} to={`/print/${item.to}`} icon={<Printer size={19} />}
      title={t(item.title)} detail={t(item.detail)} />)}
    <ListLink to="/you/reminders" icon={<Download size={19} />} title={t("settingsReminders")} detail={t("printReminder")} />
    <ListLink to="/you/data" icon={<Download size={19} />} title={t("settingsBackup")} detail={t("printBackup")} />
  </div>;
}

export function WordPrintSheet() {
  const { t, language } = useCopy();
  const [params] = useSearchParams();
  const word = splitArabicWords(params.get("word")?.slice(0, 64) ?? "")[0];
  const back = params.get("back");
  const returnPath = back?.startsWith("/learn/") ? back : "/learn";
  if (!word) return <Link className="action light" to={returnPath}>{t("continueLearning")}</Link>;
  const source = params.get("source")?.slice(0, 80);
  const { letters, syllables, curated, modern } = wordAnatomy(word);
  return <div className="print-page stack" data-sheet="word-card">
    <div className="equal-row no-print"><Link className="action light" to={returnPath}>{t("back")}</Link>
      <button className="action" type="button" onClick={() => void printPaper()}><Printer size={18} />{t("anatomyPrintWord")}</button></div>
    <header className="paper-header row-between"><div><h1>{t("anatomyWordCard")}</h1><p className="paper-note">{source}</p></div><Wordmark print /></header>
    <section className="card stack">
      <ArabicText text={word} citation={source} />
      <p lang="ar-Latn" dir="ltr">{curated?.translit ?? syllables.map(item => item.tr).join(" · ")}</p>
      {(curated?.meaning || params.get("meaning")) && <p className="muted" lang={curated ? "en" : undefined} dir="auto">
        {curated?.meaning ?? params.get("meaning")?.slice(0, 120)}</p>}
      <h2>{t("lettersRtl")}</h2>
      <div className="paper-word-letters" dir="rtl">{letters.map((letter, index) => <div className="card soft" key={index}>
        <ArabicText text={letter.glyph} compact /><small dir="auto">
          {language === "bn" ? letter.nameBn ?? letter.name : letter.name} · {letter.silent ? t("silent") : letter.sound || t("noMark")}
        </small>
      </div>)}</div>
      <div className="equal-row">{[word, modern].map((spelling, index) => <div className="card soft" key={index}>
        <p className="caption">{t(index ? "modernSpelling" : "quranSpelling")}</p><ArabicText text={spelling} compact /></div>)}</div>
    </section>
  </div>;
}

export function PrintSheet({ settings, now }: { settings: Settings; now: Date }) {
  const { t, locale, language } = useCopy();
  const { sheet, family } = useParams();
  const { state } = useLocation();
  const fromPractice = sheet === "umrah-guide" && state?.from === "umrah-guide";
  const title = sheets.find(item => item.to.split("/")[0] === sheet)?.title;
  const [selected, setSelected] = useState(108);
  const day = dateKey(now, settings.city.timeZone);
  const config = useRecord("calendar", calendarDefaults);
  const mosques = useRecord("mosques", mosqueDefaults);
  const qada = useRecord("qada", qadaDefaults);
  const logs = usePrayerLogs();
  const zakat = useRecord("zakat", initialZakat);
  if (!title) return <Link to="/print">{t("printChoose")}</Link>;
  const numbers = new Intl.NumberFormat(locale);
  const plainNumber = new Intl.NumberFormat(locale, { useGrouping: false });
  let heading = t(title);
  let subtitle: string | undefined;
  let content;
  if (sheet === "timetable" || sheet === "ramadan") {
    const current = hijriOn(day, settings.hijriAdjust, config.anchors);
    const ramadanYear = current.year + Number(current.month > 9);
    const ramadan = monthStart(ramadanYear, 9, settings.hijriAdjust, config.anchors);
    const next = monthStart(ramadanYear, 10, settings.hijriAdjust, config.anchors);
    const start = sheet === "ramadan" ? ramadan.date : `${day.slice(0, 7)}-01`;
    const numDays = sheet === "ramadan"
      ? Math.round((Date.parse(next.date) - Date.parse(ramadan.date)) / 86400000)
      : new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate();
    const ids = sheet === "ramadan" ? ["fajr", "maghrib"] as const : ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
    const zone = settings.city.timeZone;
    const timeStyle = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
    const timeFormat = new Intl.DateTimeFormat(locale, { timeZone: zone, ...timeStyle });
    const savedTimeFormat = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...timeStyle });
    const time = (date: Date) => Number.isFinite(date.valueOf()) ? timeFormat.format(date) : "—";
    const savedTime = (value: string) => {
      if (value === "adhan+5") return t("mosqueAdhanFive", mosqueAdhanOffset);
      const date = new Date(`2000-01-01T${value}:00Z`);
      return Number.isFinite(date.valueOf()) ? savedTimeFormat.format(date) : "—";
    };
    const first = hijriOn(start, settings.hijriAdjust, config.anchors);
    const last = hijriOn(addDays(start, numDays - 1), settings.hijriAdjust, config.anchors);
    const firstMonth = planMonth(first.month, language);
    const lastMonth = t("printHijriMonthYear", { month: planMonth(last.month, language), year: plainNumber.format(last.year) });
    const months = first.month === last.month && first.year === last.year ? lastMonth : t("printHijriRange", {
      first: first.year === last.year ? firstMonth : t("printHijriMonthYear", { month: firstMonth, year: plainNumber.format(first.year) }),
      last: lastMonth,
    });
    heading = sheet === "ramadan" ? t("printRamadanTitle", { year: plainNumber.format(ramadanYear) })
      : t("printMonthTitle", { month: formatDay(start, { month: "long", year: "numeric" }, locale) });
    subtitle = t("printPrayerContext", {
      city: prayerCityLabel(settings.city, t), method: t(`settingsMethod${settings.method}`),
      asr: t(settings.school === "hanafi" ? "profileHanafiAsr" : "profileStandardAsr"), months,
    });
    const mosquesWithTimes = mosques.mosques.filter(mosque =>
      prayerIds.some(id => mosque.jamaat[id]) || mosque.jumuah?.khutbah || mosque.jumuah?.prayer);
    content = <>
      <div className="table-scroll" role="region" aria-label={heading} tabIndex={0}>
        <table className="paper-timetable"><thead><tr>
          <th scope="col">{t("printDay")}</th><th scope="col">{t("printDate")}</th><th scope="col">{t("printHijri")}</th>
          {ids.map(id => <th scope="col" key={id}>{t(id === "sunrise" ? "printSunrise" : sheet === "ramadan" && id === "maghrib" ? "printIftar" : id)}</th>)}
        </tr></thead>
        <tbody>{Array.from({ length: numDays }, (_, i) => {
          const date = addDays(start, i);
          const timings = schedule(date, settings.city, settings.method, settings.school);
          const hijri = hijriOn(date, settings.hijriAdjust, config.anchors);
          const confirmed = monthStart(hijri.year, hijri.month, settings.hijriAdjust, config.anchors).confirmed;
          const weekday = mosqueWeekday(date);
          return <tr key={date} data-friday={weekday === 5}>
            <td>{formatDay(date, { weekday: "short" }, locale)}</td>
            <td><time dateTime={date}>{formatDay(date, { day: "numeric", month: sheet === "ramadan" ? "short" : undefined }, locale)}</time></td>
            <td>{plainNumber.format(hijri.day)}{(i === 0 || hijri.day === 1) && ` ${planMonth(hijri.month, language)}`}{!confirmed && "*"}</td>
            {ids.map(id => {
              const jamaat = id !== "sunrise" && mosqueTime(assignedMosque(weekday, id, mosques), id, weekday);
              const label = jamaat === "adhan+5" ? Number.isFinite(timings[id].valueOf())
                ? time(new Date(timings[id].valueOf() + mosqueAdhanOffset.count * 60_000)) : t("mosqueAdhanFiveLong", mosqueAdhanOffset)
                : jamaat && savedTime(jamaat);
              return <td key={id}><bdi>{time(timings[id])}</bdi>
                {label && <small className="block muted no-print">{t("printJamaatTime", { time: label })}</small>}</td>;
            })}
          </tr>;
        })}</tbody>
      </table></div>
      {mosquesWithTimes.length > 0 && <div className="paper-mosques">{mosquesWithTimes.map(mosque => <section className="card" key={mosque.id}>
        <small>{t(mosqueRoleLabel[mosque.role])} · <bdi>{mosque.name}</bdi></small>
        <p><strong>{[
          ...prayerIds.filter(id => mosque.jamaat[id]).map(id => t("printNamedTime", { name: t(id), time: savedTime(mosque.jamaat[id]) })),
          ...(mosque.jumuah?.khutbah ? [t("mosqueDeskKhutbah", { time: savedTime(mosque.jumuah.khutbah) })] : []),
          ...(mosque.jumuah?.prayer ? [t("printNamedTime", { name: t("mosqueJumuahTime"), time: savedTime(mosque.jumuah.prayer) })] : []),
        ].join(" · ")}</strong></p>
      </section>)}</div>}
      <p className="paper-note">{t("printHijriNote")} {t("printTimetableNote")} {t("printBrandCredit")}</p>
    </>;
  } else if (sheet === "takhti") {
    const group = families.find(item => item.id === family) ?? families[0];
    const letters = lettersForFamily(group.id);
    const first = letters[0];
    const letterName = (letter: typeof first) => language === "bn" ? letter.nameBn : letter.name;
    heading = t("printTakhtiTitle", { family: studyNames.family(language, group.id, group.title.toLowerCase()) });
    subtitle = t(group.id === "boat" ? "printBoatIntro" : "printTraceIntro");
    content = <>
      <div className="paper-name-fields equal-row"><span>{t("printName")}</span><span>{t("printDate")}</span></div>
      <div className="paper-letter-rows">{letters.map(letter => <section className="paper-letter-row" key={letter.letter}>
        <h2>{letterName(letter)}</h2><ArabicText text={Array(6).fill(letter.letter).join(" ")} />
      </section>)}</div>
      <section className="card tint paper-joining">
        <p>{t("printTakhtiJoin", { letter: letterName(first) })}</p>
        <div className="equal-row">{letterForms(first).reverse().map(form => <div key={form.key}>
          <ArabicText text={form.text} /><p>{t(form.key)}</p>
        </div>)}</div>
      </section>
      <div className="equal-row paper-harakat">{["َ", "ِ", "ُ"].map(mark => {
        const text = first.letter + mark;
        const tile = wordAnatomy(text).letters[0];
        const name = tile.details[0];
        return <div className="card" key={mark} style={{ "--mark-color": `var(--c-${tile.color})` } as React.CSSProperties}>
          <ArabicText text={text} /><p dir="ltr">{t("printTakhtiSound", {
            letter: letterName(first), mark: language === "bn" ? name.nameBn ?? name.name : name.name, sound: tile.sound,
          })}</p>
        </div>;
      })}</div>
      <p className="paper-note">{t("printTakhtiNote", { index: families.indexOf(group) + 1, count: families.length })} {t("printBrandCredit")}</p>
    </>;
  } else if (sheet === "surah-cards") {
    const cards = [selected, ...pocketSet.filter(number => number !== selected)].slice(0, 4);
    const english = showEnglishQuranMeaning(settings);
    heading = t("printSurahTitle");
    subtitle = t("printSurahIntro");
    content = <>
      <label className="field no-print">{t("printSurahFirst")}<select value={selected} onChange={event => setSelected(Number(event.target.value))}>
        {printSurahs.map(surah => <option key={surah.number} value={surah.number}>{studyNames.surah(language, surah.number, surah.transliteration)}</option>)}
      </select></label>
      <div className="paper-pocket-cards">{cards.map(number => {
        const surah = printSurahs.find(item => item.number === number);
        const verses = quranText[number];
        const transliteration = cardTransliteration[number];
        return <section className="card" key={number}>
          <div className="row-between"><h2>{t("printSurahLabel", { number, name: studyNames.surah(language, number, surah.transliteration) })}</h2>
            <small>{t("printSurahWords", { count: surah.words })}</small></div>
          <div className="paper-card-verses" dir="rtl" aria-label={t("printVerseRange", { surah: number, end: verses.length })}>
            {verses.map(verse => <ArabicText key={verse.ref} text={verseLines(verse[settings.script])} mushaf={settings.script} citation={verse.ref} verse={verse.ref} />)}
          </div>
          {transliteration && <p className="paper-transliteration" lang="ar-Latn" dir="ltr">{transliteration}</p>}
          {english && <p lang="en" dir="ltr">{verses.map(verse => verse.english).join(" ")}</p>}
        </section>;
      })}</div>
      <p className="paper-note">{t(settings.script === "indopak" ? "printIndopakCredit" : "printUthmaniCredit")}
        {english && <> · {t("printPickthallCredit")}</>} · {t("printBrandCredit")}</p>
    </>;
  } else if (sheet === "umrah-guide") {
    heading = t("umrahPracticePocket");
    content = <div className="umrah-pocket compact-stack">
      <ol className="umrah-pocket-steps">
        {ritual.steps.map((step, i) => <li className="card" key={step.id}>
          <h2>{numbers.format(i + 1)} · {t(umrahStepTitle(step.id))}</h2>
          <p>{t(umrahStepSummary(step.id))}</p>
          <p className="paper-note"><UmrahRitualSources sources={step.sources} /></p>
          {step.counter && <div className="umrah-paper-count">
            <p>{t(step.id === "tawaf" ? "umrahPracticePaperRounds" : "umrahPracticePaperLaps")}</p>
            <ol>{Array.from({ length: 7 }, (_, index) => <li key={index}>{numbers.format(index + 1)}</li>)}</ol>
          </div>}
        </li>)}
      </ol>
      <div className="umrah-pocket-duas">
        <UmrahRitualDua kind="talbiyah" /><UmrahRitualDua kind="good" />
      </div>
      <p className="paper-note">{t("umrahGuideScholars")}</p>
    </div>;
  } else if (sheet === "qada-sheet") {
    const { madeUp, remaining } = qadaBalances(qada, logs);
    content = <><table className="paper-balances"><thead><tr><th scope="col">{t("prayer")}</th><th scope="col">{t("printQadaLeft")}</th>
      <th scope="col">{t("printQadaDone")}</th></tr></thead><tbody>
      {prayerIds.map(id => <tr key={id}><th scope="row">{t(id)}</th><td>{numbers.format(remaining[id])}</td><td>{numbers.format(madeUp[id])}</td></tr>)}
    </tbody></table>
      <p>{t("printQadaGoal", { goal: qada.withEachPrayer ? t("qadaEach") : t("qadaPace", { count: qada.dailyGoal }) })}</p>
      <p>{t("printFastsLeft", { count: Math.max(0, qada.fasts - qada.fastsMadeUp) })}</p></>;
  } else {
    const result = zakatProfileTotals(zakat);
    const money = (value?: number) => value === undefined ? "—" : zakatMoney(value, zakat.currency, locale, true);
    heading = t("zakatPrintTitle");
    content = <><p>{t("zakatNet")} · {money(result.net)}</p>
      <p>{t("zakatNisabLabel", { metal: t(metalLabels[zakat.basis]) })} · {money(result.nisab)}</p>
      <p>{t("zakatEstimated")} · {money(result.due)}</p>
      <h2>{t("zakatPayments")}</h2>{zakat.payments.length ? zakat.payments.map((item, i) => <p key={i}>
        <time dateTime={item.day}>{formatDay(item.day, { dateStyle: "medium" }, locale)}</time>
        {item.name && <> · <bdi>{item.name}</bdi></>} · <bdi>{zakatMoney(item.amount, item.currency, locale, true)}</bdi>
      </p>) : <p>{t("zakatNoPayments")}</p>}
      <p className="muted small">{t("zakatWornNote")}</p>
      <p className="small zakat-sources">{Object.entries(zakatSources).map(([key, href]) => <a key={key} href={href} rel="noreferrer">{t(key)}</a>)}</p></>;
  }
  return <div className="print-page stack" data-sheet={sheet}>
    <div className="no-print equal-row">
      {fromPractice ? <Link to="/plan/umrah-guide" className="action light">{t("umrahPracticeBack")}</Link>
        : <Link to="/print" className="action light">{t("printAll")}</Link>}
      <button className="action" type="button" onClick={() => void printPaper()}><Printer size={18} />{t("printA4")}</button>
    </div>
    <header className="paper-header row-between"><div><h1>{heading}</h1>{subtitle && <p className="paper-note">{subtitle}</p>}</div><Wordmark print /></header>
    {content}
  </div>;
}
