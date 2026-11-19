import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { ListLink, SectionNav } from "@/components/Surface";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { addDays, dateKey, formatDay, formatTime } from "@/lib/dates";
import { calendarDefaults, hijriLabel, hijriOn, monthStart } from "@/lib/hijri";
import { jamaatForPrayer, mosqueDefaults } from "@/lib/mosques";
import { prayerDay, schedule } from "@/lib/prayerServices";
import { qadaDefaults } from "@/lib/qada";
import { families, lettersForFamily } from "@/lib/takhti";
import { calculateZakat, initialZakat, zakatMoney } from "@/lib/zakat";
import type { Settings } from "@/lib/storageService";
import { prayerIds, prayerNames } from "@/types/Prayer";
import { TraceBoard } from "./Takhti";
import { quranText } from "@/lib/quran";
import surahs from "../../docs/content/surahs-for-salah.json";
import ritual from "../../docs/content/umrah-steps.json";

const sheets = [
  { to: "timetable", title: "Monthly prayer timetable", detail: "Adhan and local jamaat times" },
  { to: "ramadan", title: "Ramadan timetable", detail: "Fajr and iftar with moon-dependent dates marked" },
  { to: "takhti/boat", title: "Takhti practice sheet", detail: "Start dots and stroke paths" },
  { to: "surah-cards", title: "Surah pocket cards", detail: "A foldable reading aid" },
  { to: "umrah-guide", title: "Umrah guide", detail: "Seven steps and spaces to count" },
  { to: "qada-sheet", title: "Make-up prayer sheet", detail: "Your current balances" },
  { to: "zakat-summary", title: "Zakat summary", detail: "Net assets, nisab and payment history" },
];

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
  const [selected, setSelected] = useState(103);
  const day = dateKey(now, settings.city.timeZone);
  const config = useRecord("calendar", calendarDefaults);
  const mosques = useRecord("mosques", mosqueDefaults);
  const qada = useRecord("qada", qadaDefaults);
  const logs = usePrayerLogs();
  const zakat = useRecord("zakat", initialZakat);
  if (!title) return <Link to="/print">Choose a print sheet</Link>;
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
    const ids = sheet === "ramadan" ? (["fajr", "maghrib"] as const) : prayerIds;
    const zone = settings.city.timeZone;
    const time = (date: Date) => Number.isFinite(date.valueOf()) ? formatTime(date, zone) : "—";
    content = <>
      <p>{settings.city.name} · {settings.method} · {settings.school === "hanafi" ? "Hanafi Asr" : "Standard Asr"}</p>
      <div className="table-scroll"><table><thead><tr><th>Date</th><th>Hijri*</th>{ids.map(id => <th key={id}>{sheet === "ramadan" && id === "maghrib" ? "Iftar" : prayerNames[id]}</th>)}</tr></thead>
        <tbody>{Array.from({ length: numDays }, (_, i) => {
          const date = addDays(start, i);
          const timings = schedule(date, settings.city, settings.method, settings.school);
          const prayers = prayerDay(date, settings.city, settings.method, settings.school, now);
          const hijri = hijriOn(date, settings.hijriAdjust, config.anchors);
          const confirmed = monthStart(hijri.year, hijri.month, settings.hijriAdjust, config.anchors).confirmed;
          return <tr key={date}><td>{formatDay(date, { day: "numeric", month: "short" })}</td><td>{hijriLabel(date, settings.hijriAdjust, config.anchors)}{!confirmed && "*"}</td>
            {ids.map(id => {
              const jamaat = jamaatForPrayer(prayers.find(prayer => prayer.id === id), zone, mosques);
              return <td key={id}>{time(timings[id])}{jamaat && <small className="block muted">Jamaat {jamaat.time}</small>}</td>;
            })}</tr>;
        })}</tbody>
      </table></div>
      <p className="muted small">* Expected date. Check the local moon-sighting decision.</p>
      {mosques.mosques.length > 0 && <footer className="compact-stack"><h3>My mosques · jamaat</h3>{mosques.mosques.map(mosque => <p key={mosque.id}><strong>{mosque.name}</strong> · {prayerIds.filter(id => mosque.jamaat[id]).map(id => `${prayerNames[id]} ${mosque.jamaat[id]}`).join(" · ")}</p>)}</footer>}
    </>;
  } else if (sheet === "takhti") {
    const group = families.find(item => item.id === family) ?? families[0];
    content = <><h2>{group.title}</h2><div className="print-traces">{lettersForFamily(group.id).map(letter => <section className="card compact-stack" key={letter.letter}>
      <div className="row-between"><h3>{letter.name}</h3><ArabicText text={letter.letter} /></div><TraceBoard letter={letter} printable />
    </section>)}</div></>;
  } else if (sheet === "surah-cards") {
    content = <>
      <label className="field no-print">Surah<select value={selected} onChange={event => setSelected(Number(event.target.value))}>{surahs.surahs.slice(0, 12).map(surah => <option key={surah.number} value={surah.number}>{surah.transliteration}</option>)}</select></label>
      <h2>{surahs.surahs.find(item => item.number === selected).transliteration}</h2>
      <div className="print-traces">{quranText[selected].map(verse => <section className="card compact-stack" key={verse.ref}><p className="caption">{verse.ref}</p>
        <ArabicText text={verse[settings.script].split(/\s+/).reduce((lines, word, index) => lines + (index === 0 ? "" : index % 4 === 0 ? "\n" : " ") + word, "")} mushaf={settings.script} citation={verse.ref} /><p>{verse.english}</p>
      </section>)}</div>
      <p className="small muted">{settings.script === "indopak" ? "DigitalKhatt IndoPak text" : "Tanzil Quran text"} · Pickthall translation</p>
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
  return <div className="print-page stack">
    <div className="no-print equal-row"><Link to="/print" className="action light">All print sheets</Link><button className="action" onClick={() => window.print()}><Printer size={18} /> Print A4</button></div>
    <header><p className="caption">awwab</p><h1>{title}</h1></header>
    {content}
  </div>;
}
