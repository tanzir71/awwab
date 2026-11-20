import { useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { Wordmark } from "@/components/DesignIcon";
import { ListLink, SectionNav } from "@/components/Surface";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, hijriMonths, hijriOn, monthStart } from "@/lib/hijri";
import { jamaatForPrayer, mosqueDefaults } from "@/lib/mosques";
import { methodNames, prayerDay, schedule } from "@/lib/prayerServices";
import { qadaDefaults } from "@/lib/qada";
import { families, lettersForFamily } from "@/lib/takhti";
import { initialZakat, metalLabels, zakatMoney, zakatProfileTotals, zakatSources } from "@/lib/zakat";
import type { Settings } from "@/lib/storageService";
import { prayerIds, prayerNames } from "@/types/Prayer";
import { quranText } from "@/lib/quran";
import { splitArabicWords, wordAnatomy } from "@/lib/wordAnatomy";
import surahs from "../../docs/content/surahs-for-salah.json";
import ritual from "../../docs/content/umrah-steps.json";
import cardTransliteration from "../../docs/content/print-surah-transliteration.json";
import { UmrahRitualDua, UmrahRitualSources } from "@/components/UmrahRitualContent";
import { umrahStepSummary, umrahStepTitle } from "@/lib/umrah-step-messages.mjs";

const sheets = [
  { to: "timetable", title: "Monthly prayer timetable", detail: "Adhan and local jamaat times" },
  { to: "ramadan", title: "Ramadan timetable", detail: "Fajr and iftar with moon-dependent dates marked" },
  { to: "takhti/boat", title: "Takhti practice sheet", detail: "Start dots and stroke paths" },
  { to: "surah-cards", title: "Surah pocket cards", detail: "A foldable reading aid" },
  { to: "umrah-guide", title: "Umrah guide", detail: "Seven steps and spaces to count" },
  { to: "qada-sheet", title: "Make-up prayer sheet", detail: "Your current balances" },
  { to: "zakat-summary", title: "Zakat summary", detail: "Net assets, nisab and payment history" },
];

const printSurahs = surahs.surahs.slice(0, 12);
const pocketSet = [108, 103, 112, 106];

function verseLines(text: string) {
  const words = text.split(/\s+/);
  return Array.from({ length: Math.ceil(words.length / 4) }, (_, i) => words.slice(i * 4, i * 4 + 4).join(" ")).join("\n");
}

export function PrintHub() {
  const { t } = useCopy();
  return <div className="stack">
    <SectionNav title="Print & export" back="/plan" />
    {sheets.map(item => <ListLink key={item.to} to={`/print/${item.to}`} icon={<Printer size={19} />}
      title={item.to === "umrah-guide" ? t("umrahPracticePocket") : item.title}
      detail={item.to === "umrah-guide" ? t("umrahPracticePocketDetail") : item.detail} />)}
    <ListLink to="/you/reminders" icon={<Download size={19} />} title="Calendar reminders" detail="Export to your device calendar" />
    <ListLink to="/you/data" icon={<Download size={19} />} title="Backup" detail="Export your on-device records" />
  </div>;
}

export function WordPrintSheet() {
  const { t } = useCopy();
  const [params] = useSearchParams();
  const word = splitArabicWords(params.get("word")?.slice(0, 64) ?? "")[0];
  const back = params.get("back");
  const returnPath = back?.startsWith("/learn/") ? back : "/learn";
  if (!word) return <Link className="action light" to={returnPath}>{t("continueLearning")}</Link>;
  const source = params.get("source")?.slice(0, 80);
  const { letters, syllables, curated, modern } = wordAnatomy(word);
  return <div className="print-page stack" data-sheet="word-card">
    <div className="equal-row no-print"><Link className="action light" to={returnPath}>{t("back")}</Link>
      <button className="action" type="button" onClick={() => window.print()}><Printer size={18} />{t("anatomyPrintWord")}</button></div>
    <header className="paper-header row-between"><div><h1>{t("anatomyWordCard")}</h1><p className="paper-note">{source}</p></div><Wordmark /></header>
    <section className="card stack">
      <ArabicText text={word} citation={source} />
      <p>{curated?.translit ?? syllables.map(item => item.tr).join(" · ")}</p>
      {(curated?.meaning || params.get("meaning")) && <p className="muted">{curated?.meaning ?? params.get("meaning")?.slice(0, 120)}</p>}
      <h2>{t("lettersRtl")}</h2>
      <div className="paper-word-letters" dir="rtl">{letters.map((letter, index) => <div className="card soft" key={index}>
        <ArabicText text={letter.glyph} compact /><small dir="ltr">{letter.name} · {letter.silent ? t("silent") : letter.sound || t("noMark")}</small>
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
  if (!title) return <Link to="/print">Choose a print sheet</Link>;
  let heading = title;
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
    const timeFormat = new Intl.DateTimeFormat("en", { timeZone: zone, hour: "numeric", minute: "2-digit", hourCycle: "h23" });
    const time = (date: Date) => Number.isFinite(date.valueOf()) ? timeFormat.format(date) : "—";
    const first = hijriOn(start, settings.hijriAdjust, config.anchors);
    const last = hijriOn(addDays(start, numDays - 1), settings.hijriAdjust, config.anchors);
    const firstMonth = hijriMonths[first.month - 1];
    const lastMonth = hijriMonths[last.month - 1];
    const months = first.month === last.month ? lastMonth : `${firstMonth} → ${lastMonth}`;
    heading = sheet === "ramadan" ? `Ramadan timetable · ${ramadanYear}` : `Prayer times · ${formatDay(start, { month: "long", year: "numeric" })}`;
    subtitle = `${settings.city.name} · ${methodNames[settings.method]} method · ${settings.school === "hanafi" ? "Hanafi Asr" : "Standard Asr"} · ${months} ${last.year}`;
    content = <>
      <div className="table-scroll"><table className="paper-timetable"><thead><tr><th scope="col">Day</th><th scope="col">Date</th><th scope="col">Hijri</th>{ids.map(id => <th scope="col" key={id}>{id === "sunrise" ? "Sunrise" : sheet === "ramadan" && id === "maghrib" ? "Iftar" : prayerNames[id]}</th>)}</tr></thead>
        <tbody>{Array.from({ length: numDays }, (_, i) => {
          const date = addDays(start, i);
          const timings = schedule(date, settings.city, settings.method, settings.school);
          const prayers = prayerDay(date, settings.city, settings.method, settings.school, now);
          const hijri = hijriOn(date, settings.hijriAdjust, config.anchors);
          const confirmed = monthStart(hijri.year, hijri.month, settings.hijriAdjust, config.anchors).confirmed;
          const weekday = formatDay(date, { weekday: "short" });
          return <tr key={date} data-friday={weekday === "Fri"}><td>{weekday}</td><td>{Number(date.slice(-2))}{sheet === "ramadan" && ` ${formatDay(date, { month: "short" })}`}</td>
            <td>{hijri.day}{(i === 0 || hijri.day === 1) && ` ${hijriMonths[hijri.month - 1]}`}{!confirmed && "*"}</td>
            {ids.map(id => {
              const prayer = prayers.find(prayer => prayer.id === id);
              const jamaat = prayer ? jamaatForPrayer(prayer, zone, mosques) : undefined;
              return <td key={id}>{time(timings[id])}{jamaat && <small className="block muted">Jamaat {jamaat.time}</small>}</td>;
            })}</tr>;
        })}</tbody>
      </table></div>
      {mosques.mosques.length > 0 && <div className="paper-mosques">{mosques.mosques.map(mosque => <section className="card" key={mosque.id}><small>{mosque.name}</small><p><strong>{prayerIds.filter(id => mosque.jamaat[id]).map(id => `${prayerNames[id]} ${mosque.jamaat[id]}`).join(" · ")}</strong></p></section>)}</div>}
      <p className="paper-note">* Expected Hijri date. Check the local moon-sighting decision. Shaded Fridays mark Jumuʿah. Times are calculated and local jamaat times can differ. Printed from Awwab.</p>
    </>;
  } else if (sheet === "takhti") {
    const group = families.find(item => item.id === family) ?? families[0];
    const letters = lettersForFamily(group.id);
    const first = letters[0];
    heading = `Takhti practice · ${group.title.toLowerCase()}`;
    subtitle = group.id === "boat" ? "One body, different dots. Trace from right to left, then add the dots." : "Trace each letter from right to left.";
    content = <>
      <div className="paper-name-fields equal-row"><span>Name</span><span>Date</span></div>
      <div className="paper-letter-rows">{letters.map(letter => <section className="paper-letter-row" key={letter.letter}>
        <h2>{letter.name}</h2><ArabicText text={Array(6).fill(letter.letter).join(" ")} />
      </section>)}</div>
      <section className="card tint paper-joining">
        <p>Joined forms of {first.name}. Write each three times.</p>
        <div className="equal-row">{(first.joinsNext ? [[`ـ${first.letter}`, "end"], [`ـ${first.letter}ـ`, "middle"], [`${first.letter}ـ`, "start"], [first.letter, "alone"]] : [[`ـ${first.letter}`, "end"], [first.letter, "alone"]]).map(([glyph, label]) => <div key={label}>
          <ArabicText text={glyph} /><p>{label}</p>
        </div>)}</div>
      </section>
      <div className="equal-row paper-harakat">{["َ", "ِ", "ُ"].map(mark => {
        const text = first.letter + mark;
        const tile = wordAnatomy(text).letters[0];
        const name = tile.details[0];
        return <div className="card" key={mark} style={{ "--mark-color": `var(--c-${tile.color})` } as React.CSSProperties}>
          <ArabicText text={text} /><p>{first.name} + {name?.name} = {tile.sound}</p>
        </div>;
      })}</div>
      <p className="paper-note">The takhti way: write, say it aloud, wipe, and write again. Printed from Awwab. Family {families.indexOf(group) + 1} of {families.length}.</p>
    </>;
  } else if (sheet === "surah-cards") {
    const cards = [selected, ...pocketSet.filter(number => number !== selected)].slice(0, 4);
    heading = "Pocket cards · shortest surahs for salah";
    subtitle = "Cut along the gaps. Keep one in your wallet and review on Sabaq → Sabqi → Manzil.";
    content = <>
      <label className="field no-print">First card<select value={selected} onChange={event => setSelected(Number(event.target.value))}>{printSurahs.map(surah => <option key={surah.number} value={surah.number}>{surah.transliteration}</option>)}</select></label>
      <div className="paper-pocket-cards">{cards.map(number => {
        const surah = printSurahs.find(item => item.number === number);
        const verses = quranText[number];
        const transliteration = cardTransliteration[number];
        return <section className="card" key={number}>
          <div className="row-between"><h2>{number} · {surah.transliteration}</h2><small>{surah.words} words</small></div>
          <div className="paper-card-verses" dir="rtl" aria-label={`Quran ${number}:1–${verses.length}`}>
            {verses.map(verse => <ArabicText key={verse.ref} text={verseLines(verse[settings.script])} mushaf={settings.script} citation={verse.ref} verse={verse.ref} />)}
          </div>
          {transliteration && <p className="paper-transliteration">{transliteration}</p>}
          <p>{verses.map(verse => verse.english).join(" ")}</p>
        </section>;
      })}</div>
      <p className="paper-note">{settings.script === "indopak" ? "DigitalKhatt IndoPak text" : "Tanzil Quran text"} · Pickthall translation. Printed from Awwab.</p>
    </>;
  } else if (sheet === "umrah-guide") {
    heading = t("umrahPracticePocket");
    const number = new Intl.NumberFormat(locale);
    content = <div className="umrah-pocket compact-stack">
      <ol className="umrah-pocket-steps">
        {ritual.steps.map((step, i) => <li className="card" key={step.id}>
          <h2>{number.format(i + 1)} · {t(umrahStepTitle(step.id))}</h2>
          <p>{t(umrahStepSummary(step.id))}</p>
          <p className="paper-note"><UmrahRitualSources sources={step.sources} /></p>
          {step.counter && <div className="umrah-paper-count">
            <p>{t(step.id === "tawaf" ? "umrahPracticePaperRounds" : "umrahPracticePaperLaps")}</p>
            <ol>{Array.from({ length: 7 }, (_, index) => <li key={index}>{number.format(index + 1)}</li>)}</ol>
          </div>}
        </li>)}
      </ol>
      <div className="umrah-pocket-duas">
        <UmrahRitualDua kind="talbiyah" /><UmrahRitualDua kind="good" />
      </div>
      <p className="paper-note">{t("umrahGuideScholars")}</p>
    </div>;
  } else if (sheet === "qada-sheet") {
    content = <><table><thead><tr><th>Prayer</th><th>Remaining</th><th>Made up</th></tr></thead><tbody>
      {prayerIds.map(id => {
        const done = qada.madeUp[id] + logs.filter(log => log.prayer === id && log.status === "qada").length;
        return <tr key={id}><td>{prayerNames[id]}</td><td>{Math.max(0, qada.estimated[id] - done)}</td><td>{done}</td></tr>;
      })}
    </tbody></table><p>Daily goal · {qada.dailyGoal} prayers</p><p>Fasts remaining · {Math.max(0, qada.fasts - qada.fastsMadeUp)}</p></>;
  } else {
    const result = zakatProfileTotals(zakat);
    const money = (value?: number) => value === undefined ? "—" : zakatMoney(value, zakat.currency, language, true);
    heading = t("zakatPrintTitle");
    content = <><p>{t("zakatNet")} · {money(result.net)}</p>
      <p>{t("zakatNisabLabel", { metal: t(metalLabels[zakat.basis]) })} · {money(result.nisab)}</p>
      <p>{t("zakatEstimated")} · {money(result.due)}</p>
      <h2>{t("zakatPayments")}</h2>{zakat.payments.length ? zakat.payments.map((item, i) => <p key={i}>
        <time dateTime={item.day}>{formatDay(item.day, { dateStyle: "medium" }, language)}</time>
        {item.name && " · " + item.name} · {zakatMoney(item.amount, item.currency, language, true)}
      </p>) : <p>{t("zakatNoPayments")}</p>}
      <p className="muted small">{t("zakatWornNote")}</p>
      <p className="small zakat-sources">{Object.entries(zakatSources).map(([key, href]) => <a key={key} href={href} rel="noreferrer">{t(key)}</a>)}</p></>;
  }
  return <div className="print-page stack" data-sheet={sheet}>
    <div className="no-print equal-row">
      {fromPractice ? <Link to="/plan/umrah-guide" className="action light">{t("umrahPracticeBack")}</Link>
        : <Link to="/print" className="action light">{sheet === "umrah-guide" ? t("umrahPracticePrintHub") : "All print sheets"}</Link>}
      <button className="action" onClick={() => window.print()}><Printer size={18} />{sheet === "umrah-guide" ? t("umrahPracticePrint") : "Print A4"}</button>
    </div>
    <header className="paper-header row-between"><div><h1>{heading}</h1>{subtitle && <p className="paper-note">{subtitle}</p>}</div><Wordmark /></header>
    {content}
  </div>;
}
