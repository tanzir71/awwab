import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { Wordmark } from "@/components/DesignIcon";
import { ListLink, SectionNav } from "@/components/Surface";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, hijriMonths, hijriOn, monthStart } from "@/lib/hijri";
import { jamaatForPrayer, mosqueDefaults } from "@/lib/mosques";
import { methodNames, prayerDay, schedule } from "@/lib/prayerServices";
import { qadaDefaults } from "@/lib/qada";
import { families, lettersForFamily } from "@/lib/takhti";
import { calculateZakat, initialZakat, zakatMoney } from "@/lib/zakat";
import type { Settings } from "@/lib/storageService";
import { prayerIds, prayerNames } from "@/types/Prayer";
import { quranText } from "@/lib/quran";
import { wordAnatomy } from "@/lib/wordAnatomy";
import surahs from "../../docs/content/surahs-for-salah.json";
import ritual from "../../docs/content/umrah-steps.json";
import cardTransliteration from "../../docs/content/print-surah-transliteration.json";

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
  return <div className="stack">
    <SectionNav title="Print & export" back="/plan" />
    {sheets.map(item => <ListLink key={item.to} to={`/print/${item.to}`} icon={<Printer size={19} />} title={item.title} detail={item.detail} />)}
    <ListLink to="/you/reminders" icon={<Download size={19} />} title="Calendar reminders" detail="Export to your device calendar" />
    <ListLink to="/you/data" icon={<Download size={19} />} title="Backup" detail="Export your on-device records" />
  </div>;
}

export function PrintSheet({ settings, now }: { settings: Settings; now: Date }) {
  const { sheet, family } = useParams();
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
    content = <ol className="compact-stack">{ritual.steps.map((step, i) => <li className="card compact-stack" key={step.id}><h3>{i + 1}. {step.title}</h3>{step.notes?.map(note => <p key={note}>{note}</p>)}
      {step.counter && <p>Rounds or laps · ○ ○ ○ ○ ○ ○ ○</p>}</li>)}</ol>;
  } else if (sheet === "qada-sheet") {
    content = <><table><thead><tr><th>Prayer</th><th>Remaining</th><th>Made up</th></tr></thead><tbody>
      {prayerIds.map(id => {
        const done = qada.madeUp[id] + logs.filter(log => log.prayer === id && log.status === "qada").length;
        return <tr key={id}><td>{prayerNames[id]}</td><td>{Math.max(0, qada.estimated[id] - done)}</td><td>{done}</td></tr>;
      })}
    </tbody></table><p>Daily goal · {qada.dailyGoal} prayers</p><p>Fasts remaining · {Math.max(0, qada.fasts - qada.fastsMadeUp)}</p></>;
  } else {
    const result = calculateZakat([zakat.cash, zakat.metals, zakat.trade], [zakat.debt], zakat.basis, zakat.price, zakat.unit);
    content = <><p>Net assets · {zakatMoney(result.net, zakat.currency)}</p>
      <p>{zakat.basis === "silver" ? "Silver" : "Gold"} nisab · {result.nisab === undefined ? "Enter a metal price in Plan" : zakatMoney(result.nisab, zakat.currency)}</p>
      <p>Zakat estimate · {result.due === undefined ? "—" : zakatMoney(result.due, zakat.currency)}</p>
      <h2>Payments</h2>{zakat.payments.map((item, i) => <p key={i}>{item.day} · {zakatMoney(item.amount, item.currency)}</p>)}
      <p className="muted small">This is a calculator. Scholars differ on worn jewellery and the choice of nisab.</p></>;
  }
  return <div className="print-page stack" data-sheet={sheet}>
    <div className="no-print equal-row"><Link to="/print" className="action light">All print sheets</Link><button className="action" onClick={() => window.print()}><Printer size={18} /> Print A4</button></div>
    <header className="paper-header row-between"><div><h1>{heading}</h1>{subtitle && <p className="paper-note">{subtitle}</p>}</div><Wordmark /></header>
    {content}
  </div>;
}
