import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Download, MapPin, Coins, BookOpen, ChevronLeft, ChevronRight, Moon } from "lucide-react";
import { toast } from "sonner";
import { ListLink, SectionHeading } from "@/components/Surface";
import { useRecord } from "@/hooks/use-awwab";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, calendarEvents, hijriLabel, hijriMonths, hijriOn, monthStart, type CalendarSettings, type MonthAnchor } from "@/lib/hijri";
import { prayerReminders, saveCalendar, eventReminders } from "@/lib/calendarFile";
import { schedule } from "@/lib/prayerServices";
import { getRecord, updateRecord, type Settings } from "@/lib/storageService";
import { mosqueDefaults } from "@/lib/mosques";

const authorities = ["National moon-sighting committee", "Saudi announcement", "My mosque", "Family"];
const labelDate = (day: string) => formatDay(day, { weekday: "short", day: "numeric", month: "short" });

export function Plan({ settings, now }: { settings: Settings; now: Date }) {
  const [query, setQuery] = useSearchParams();
  const [span, setSpan] = useState(90);
  const [monthOffset, setMonthOffset] = useState(0);
  const config = useRecord("calendar", calendarDefaults);
  const mosques = useRecord("mosques", mosqueDefaults);
  const day = dateKey(now, settings.city.timeZone);
  const events = calendarEvents(day, addDays(day, span), settings.hijriAdjust, config)
    .filter(item => item.kind !== "weekly");
  const selected = events.find(item => item.id === query.get("event"));
  const hijri = hijriOn(day, settings.hijriAdjust, config.anchors);
  const previewMonth = hijri.year * 12 + hijri.month - 1 + monthOffset;
  const displayYear = Math.floor(previewMonth / 12);
  const displayMonth = previewMonth % 12 + 1;
  const displayStart = monthStart(displayYear, displayMonth, settings.hijriAdjust, config.anchors);
  const followingStart = monthStart(Math.floor((previewMonth + 1) / 12), (previewMonth + 1) % 12 + 1, settings.hijriAdjust, config.anchors);
  const displayLength = Math.round((Date.parse(followingStart.date) - Date.parse(displayStart.date)) / 86400000);
  const before = new Date(`${displayStart.date}T12:00:00Z`).getUTCDay();
  const nextMonth = hijri.month === 12 ? 1 : hijri.month + 1;
  const nextYear = hijri.year + Number(nextMonth === 1);
  const next = monthStart(nextYear, nextMonth, settings.hijriAdjust, config.anchors);
  const watchDate = addDays(monthStart(hijri.year, hijri.month, settings.hijriAdjust, config.anchors).date, 28);
  const maghrib = schedule(day, settings.city, settings.method, settings.school).maghrib;
  const moonWatch = hijri.day === 29 && now >= maghrib && !monthStart(nextYear, nextMonth, settings.hijriAdjust, config.anchors).confirmed;
  const [authority, setAuthority] = useState(authorities[0]);
  const [newCalendar, setNewCalendar] = useState(false);
  const [eidLocation, setEidLocation] = useState<"home" | "hometown">("home");

  async function save(change: (old: CalendarSettings) => CalendarSettings) {
    try {
      await updateRecord("calendar", calendarDefaults, change);
      const updated = await getRecord("calendar", calendarDefaults);
      saveCalendar([...prayerReminders(day, settings, 30, 5), ...eventReminders(day, settings, updated)]);
      setNewCalendar(true);
    } catch {
      toast.error("The calendar change could not be saved. Try again.");
    }
  }

  function confirmMonth(anchor: MonthAnchor) {
    return save(old => ({ ...old, anchors: [...old.anchors.filter(item => item.year !== anchor.year || item.month !== anchor.month), anchor] }));
  }

  return <div className="stack">
    <header><p className="caption">Plan</p><h1>Islamic calendar</h1><p className="muted">{hijriLabel(day, settings.hijriAdjust, config.anchors)}</p></header>
    {moonWatch && <section className="card night stack">
      <h2>Was the moon seen?</h2><p>Record the local decision for {hijriMonths[nextMonth - 1]}.</p>
      <label className="field text-[var(--c-ink)]"><span className="text-[var(--c-on-night)]">Confirmation source</span><select value={authority} onChange={event => setAuthority(event.target.value)}>{authorities.map(item => <option key={item}>{item}</option>)}</select></label>
      <div className="equal-row">
        <button className="action gold" onClick={() => void confirmMonth({ year: nextYear, month: nextMonth, date: addDays(day, 1), source: authority })}>Starts tomorrow</button>
        <button className="action light" onClick={() => void confirmMonth({ year: nextYear, month: nextMonth, date: addDays(day, 2), source: authority })}>Complete 30 days</button>
      </div>
    </section>}
    {!moonWatch && !next.confirmed && <section className="card night stack">
      <p className="caption with-icon"><Moon size={16} /> Moon watch</p>
      <h2>{hijriMonths[nextMonth - 1]} starts {labelDate(next.date)} or {labelDate(addDays(next.date, 1))}</h2>
      <p className="muted">The date depends on the local crescent sighting. Moon watch is on {labelDate(watchDate)} after Maghrib.</p>
      <button className="action gold" onClick={() => {
        const time = schedule(watchDate, settings.city, settings.method, settings.school).maghrib;
        if (Number.isFinite(time.valueOf())) saveCalendar([{ id: `moon-watch-${nextYear}-${nextMonth}`, title: `Check the moon for ${hijriMonths[nextMonth - 1]}`, start: time, alarm: 0 }], "awwab-moon-watch.ics");
      }}>Add moon watch reminder</button>
    </section>}
    <section className="card stack">
      <div className="row-between">
        <h2>{hijriMonths[displayMonth - 1]} {displayYear}</h2>
        <div className="with-icon">
          <button type="button" className="icon-button" onClick={() => setMonthOffset(value => value - 1)} aria-label="Previous Hijri month"><ChevronLeft size={20} /></button>
          <button type="button" className="icon-button" onClick={() => setMonthOffset(value => value + 1)} aria-label="Next Hijri month"><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="month-grid" aria-label={`Hijri month of ${hijriMonths[displayMonth - 1]}`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(name => <small className="muted" key={name}>{name}</small>)}
        {Array.from({ length: before }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: displayLength }, (_, i) => {
          const date = addDays(displayStart.date, i);
          const dayEvents = calendarEvents(date, date, settings.hijriAdjust, config).filter(
            event => event.kind !== "weekly" && event.hijriMonth !== 0);
          const event = dayEvents[0];
          const status = date === day ? "current" : i >= 12 && i <= 14 ? "white-days" : i >= 28 && !followingStart.confirmed ? "expected" : "";
          const label = `${i + 1} ${hijriMonths[displayMonth - 1]} · ${labelDate(date)}${event ? ` · ${event.title}` : ""}`;
          return <span className="month-day" key={date} data-kind={status} title={label}>
            {event && events.some(item => item.id === event.id)
              ? <button type="button" aria-label={label} onClick={() => setQuery({ event: event.id })}><strong>{i + 1}</strong><small>{Number(date.slice(-2))} ·</small></button>
              : <span aria-label={label}><strong>{i + 1}</strong><small>{Number(date.slice(-2))}</small></span>}
          </span>;
        })}
      </div>
      <div className="chips"><span className="chip night">Today</span><span className="chip">White days</span><span className="chip soft">Depends on moon</span></div>
    </section>
    {selected && <section className="card stack" aria-label="Selected event">
      <div className="row-between"><h2>{selected.title}</h2><button className="text-button" onClick={() => setQuery({})}>Close</button></div>
      <p>{selected.dates.map(labelDate).join(" or ")} · {selected.confirmed ? "Confirmed" : "Expected"}</p>
      {selected.source && <p className="muted">Confirmed by {selected.source}</p>}
      <label className="field">Confirmation source<select value={authority} onChange={event => setAuthority(event.target.value)}>{authorities.map(item => <option key={item}>{item}</option>)}</select></label>
      {!selected.confirmed && <div className="equal-row">
        {selected.dates.map(date => <button className="action soft" key={date} onClick={() => {
          if (selected.hijriDay === 1) void confirmMonth({ year: selected.year, month: selected.month, date, source: authority });
          else void save(old => ({ ...old, overrides: { ...old.overrides, [selected.id]: { date, source: authority, adjust: 0 } } }));
        }}>Confirm {labelDate(date)}</button>)}
      </div>}
      <label className="field">Adjust this event
        <select value={config.overrides[selected.id]?.adjust ?? 0} onChange={event => {
          const adjust = Number(event.target.value) as -1 | 0 | 1;
          void save(old => ({ ...old, overrides: { ...old.overrides, [selected.id]: { adjust } } }));
        }}>
          <option value={-1}>One day earlier</option><option value={0}>Follow the month</option><option value={1}>One day later</option>
        </select>
      </label>
      {selected.title.startsWith("Eid") && <>
        <h3>Where will you pray?</h3>
        <div className="equal-row">{(["home", "hometown"] as const).map(location => <button key={location} aria-pressed={eidLocation === location} className={`action ${eidLocation === location ? "" : "light"}`} onClick={() => setEidLocation(location)}>{location === "home" ? "Home city" : "Hometown"}</button>)}</div>
        {mosques.mosques.filter(mosque => mosque.role === eidLocation || (eidLocation === "home" && mosque.role === "eid")).map(mosque => {
          const year = Number(selected.dates[0].slice(0, 4));
          const records = mosque.occasional.filter(item => item.type === (selected.title.includes("Fitr") ? "eid_fitr" : "eid_adha") && item.year >= year - 1 && item.year <= year);
          return <div key={mosque.id} className="card soft compact-stack"><strong>{mosque.name}</strong>
            {records.length ? records.map(item => <p key={item.year}>{item.year === year ? "This year" : "Last year"} · {item.times.join(", ")}</p>) : <p>No jamaat time recorded yet.</p>}</div>;
        })}
        <Link className="action soft" to="/plan/mosques">Manage mosque times</Link>
      </>}
    </section>}
    {newCalendar && <p className="card soft" role="status">Dates updated. Open the new calendar file to update your reminders.</p>}
    <section className="compact-stack">
      <SectionHeading title="Coming up" to="/you/hijri" label="Adjust Hijri date" />
      <p className="muted small">Moon-dependent dates are expected until confirmed locally.</p>
      {events.map(event => <button key={event.id} className="list-row" onClick={() => setQuery({ event: event.id })}>
        <span className="icon-box"><CalendarDays size={20} /></span><span><strong>{event.title}</strong><small>{event.dates.map(labelDate).join(" or ")} · {event.label}</small></span>
        <span className={`chip ${event.confirmed ? "soft" : ""}`}>{event.confirmed ? "Confirmed" : "Expected"}</span>
      </button>)}
      {span < 365 && <button className="action light" onClick={() => setSpan(365)}>See the year ahead</button>}
    </section>
    <button className="action" onClick={() => {
      saveCalendar([...prayerReminders(day, settings, 30, 5), ...eventReminders(day, settings, config)]);
      setNewCalendar(false);
    }}><Download size={19} /> Export calendar file</button>
    <section className="compact-stack">
      <ListLink to="/plan/mosques" icon={<MapPin size={20} />} title="My mosques" detail="Keep your local jamaat times close" />
      <ListLink to="/plan/zakat" icon={<Coins size={20} />} title="Zakat" detail="Estimate and record your zakat" />
      <ListLink to="/umrah" icon={<BookOpen size={20} />} title="Umrah" detail="Prepare for your trip" />
    </section>
  </div>;
}
