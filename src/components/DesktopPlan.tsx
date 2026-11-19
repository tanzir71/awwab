import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useDesktop } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, formatDay, formatTime } from "@/lib/dates";
import { calendarEventById, calendarEvents, eventDisplayDates, hijriOn, monthStartEvent, moonWatchDay, type CalendarEvent, type CalendarSettings } from "@/lib/hijri";
import { mosqueClock, mosqueWeekday, type MosquePlan } from "@/lib/mosques";
import { calendarDayEvents, calendarMonthOn, calendarWeekStart, fridayMosque, gregorianMonthBounds, gregorianMonthCells,
  monthStartsInRange, readCalendarDay, readCalendarMonth, shiftPlanEvent } from "@/lib/plan-calendar";
import { planAuthorities, planEventLabels, planMonth } from "@/lib/plan-copy";
import { schedule } from "@/lib/prayerServices";
import type { Settings } from "@/lib/storageService";
import type { zakatHawl } from "@/lib/zakat";
import { prayerIds } from "@/types/Prayer";
import { EventSheet } from "./PlanEventSheet";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./ui/dialog";

type Hawl = ReturnType<typeof zakatHawl>;
type OpenEvent = (trigger: MouseEvent<HTMLElement>, event: CalendarEvent, day?: string, source?: string) => void;
type SaveCalendar = (change: (old: CalendarSettings) => CalendarSettings) => Promise<boolean>;
type PlanProps = {
  today: string; now: Date; settings: Settings; config: CalendarSettings; mosques: MosquePlan; hawl: Hawl; saved: boolean;
  exportCalendar: () => void; saveCalendar: SaveCalendar;
  confirmEvent: (event: CalendarEvent, date: string, source: string, moveAfter: boolean) => Promise<boolean>;
};
const isWhiteDays = (event: CalendarEvent) => event.title.startsWith("White days");
const important = ["Ramadan begins", "Eid al-Fitr", "Day of ʿArafah (fast if not on Hajj)", "Eid al-Adha", "Islamic New Year", "ʿĀshūrāʾ (fast 9 & 10)"];

function moveListFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "j" && event.key !== "k" || event.altKey || event.ctrlKey || event.metaKey) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(".plan-desk-row")];
  const index = items.findIndex(item => item === event.target);
  if (index < 0) return;
  event.preventDefault();
  items[(index + (event.key === "j" ? 1 : items.length - 1)) % items.length]?.focus();
}

function MoonCard({ event, config, open, shift, district, watchNow }: {
  event: CalendarEvent; config: CalendarSettings; open: OpenEvent; shift: (step: -1 | 1) => void; district: boolean; watchNow: boolean;
}) {
  const { t, language } = useCopy();
  const [title] = planEventLabels(event, language);
  const source = planAuthorities.find(item => item.value === event.source);
  const offset = config.overrides[event.id]?.adjust ?? 0;
  return <section className="card night plan-desk-moon compact-stack" aria-label={t("planMoonWatch")}>
    <p className="caption">{t(event.confirmed ? "confirmedDate" : "planDeskMoonDependent")}</p>
    <h2><button type="button" onClick={trigger => open(trigger, event)}>{title}</button></h2>
    <p className="muted small">{eventDisplayDates(event, language, t("planOr"))} · {t(event.confirmed ? "confirmedDate" : "expectedDate")}</p>
    {event.confirmed ? event.source && <p className="muted small">{t("planConfirmedBy", {
      source: source ? t(source === planAuthorities[0] && district ? "planNationalBd" : source.label) : event.source,
    })}</p> : <>
      {watchNow && <>
        <p>{t("planSeen")}</p>
        <div className="equal-row plan-desk-moon-actions">
          <button type="button" className="action plan-moon-primary" onClick={trigger => open(trigger, event, event.dates[0])}>{t("planTomorrow")}</button>
          <button type="button" className="action light" onClick={trigger => open(trigger, event, event.dates[1])}>{t("planCompleteThirty")}</button>
        </div>
      </>}
      <p className="muted small">{t("planDeskConfirmFrom")}</p>
      <div className="plan-desk-sources" role="group" aria-label={t("planSighting")}>
        {planAuthorities.map((item, i) => <button type="button" key={item.value} onClick={trigger => open(trigger, event, undefined, item.value)}>
          {t(i === 0 && district ? "planNationalBd" : item.label)}
        </button>)}
      </div>
      <div className="plan-desk-shift">
        <span className="small muted">{t("planDeskShiftMonth")}</span>
        <div className="equal-row" role="group" aria-label={t("planDeskShiftMonth")}>
          {([-1, 1] as const).map(step => <button key={step} type="button" aria-pressed={offset === step}
            onClick={() => shift(step)}>{t(step < 0 ? "planDeskShiftEarlier" : "planDeskShiftLater")}</button>)}
        </div>
      </div>
    </>}
  </section>;
}

function UpcomingCard({ events, hawl, today, open }: { events: CalendarEvent[]; hawl: Hawl; today: string; open: OpenEvent }) {
  const { t, language } = useCopy();
  const [expanded, setExpanded] = useState(false);
  const nextWhite = events.find(isWhiteDays);
  const limited = events.filter(event => event === nextWhite || important.includes(event.title)).slice(0, 5);
  const rows = (expanded ? events : limited).map(event => ({ date: event.dates[0], key: event.id, event }));
  const visibleHawl = hawl && hawl.date >= today ? [{ date: hawl.date, key: "hawl", event: undefined }] : [];
  const sorted = [...rows, ...visibleHawl].sort((a, b) => a.date.localeCompare(b.date));
  const yearNumber = new Intl.NumberFormat(language, { useGrouping: false });

  return <section className="card compact-stack plan-desk-upcoming">
    <div className="row-between"><h2>{t("planUpcoming")}</h2>
      <button type="button" className="text-button" aria-expanded={expanded} onClick={() => setExpanded(old => !old)}>
        {t(expanded ? "planDeskFewerEvents" : "planDeskAllEvents")}
      </button>
    </div>
    <ul className="plan-desk-list" onKeyDown={moveListFocus}>
      {(expanded ? sorted : sorted.slice(0, 4)).map(({ key, event }) => <li key={key}>{event ?
        <button type="button" className="plan-desk-row" onClick={trigger => open(trigger, event)}>
          <span><strong>{planEventLabels(event, language)[0]}</strong><small className="muted">{eventDisplayDates(event, language, t("planOr"))}</small></span>
          <span className="plan-desk-badge" data-confirmed={event.confirmed}>{t(event.confirmed ? "confirmedDate" : "expectedDate")}</span>
        </button> : <Link to="/plan/zakat" className="plan-desk-row">
          <span><strong>{t("planPersonalZakatDate")}</strong><small className="muted">{yearNumber.format(hawl.day)} {planMonth(hawl.month, language)} {yearNumber.format(hawl.year)}</small></span>
          <span className="plan-desk-badge" data-confirmed="true">{t("yours")}</span>
        </Link>}</li>)}
    </ul>
  </section>;
}

function EidCard({ event, mosques, open }: { event?: CalendarEvent; mosques: MosquePlan; open: OpenEvent }) {
  const { t, language } = useCopy();
  const type = event?.title === "Eid al-Adha" ? "eid_adha" : "eid_fitr";
  const year = Number(event?.dates[0].slice(0, 4));
  const options = mosques.mosques.flatMap(mosque => {
    const current = mosque.occasional.find(item => item.type === type && item.year === year);
    const previous = mosque.occasional.find(item => item.type === type && item.year === year - 1);
    return current || previous ? [{ mosque, entry: current ?? previous, current: Boolean(current) }] : [];
  });
  return <section className="card compact-stack plan-desk-eid">
    <div className="row-between"><h2>{t("planEidWhere")}</h2>{event &&
      <button type="button" className="text-button" onClick={trigger => open(trigger, event)}>{t("qadaEdit")}</button>}</div>
    {options.length > 0 ? <ul className="plan-desk-list" onKeyDown={moveListFocus}>{options.map(({ mosque, entry, current }) => <li key={mosque.id}>
      <button className="plan-desk-row" type="button" onClick={trigger => open(trigger, event)}>
        <span><strong>{mosque.name}</strong><small className="muted">{entry.times.map(time => mosqueClock(time, language, true)).join(" · ")}
          {" · "}{t(current ? "planEidThisYear" : "planEidLastYear")}</small></span>
      </button>
    </li>)}</ul> : <p className="small muted">{t("planDeskEidPending")}</p>}
  </section>;
}

function DayDetails({ day, events, today, settings, config, mosques, open, close }: {
  day: string; events: CalendarEvent[]; today: string; settings: Settings; config: CalendarSettings; mosques: MosquePlan;
  open: OpenEvent; close: () => void;
}) {
  const { t, language } = useCopy();
  const date = hijriOn(day, settings.hijriAdjust, config.anchors);
  const number = new Intl.NumberFormat(language, { useGrouping: false });
  const friday = mosqueWeekday(day) === 5;
  const mosque = friday ? fridayMosque(mosques) : undefined;
  const times = schedule(day, settings.city, settings.method, settings.school);
  return <section className="card compact-stack plan-desk-day-panel" aria-label={t("planDetails")}>
    <div className="row-between">
      <div><p className="caption">{t(day === today ? "today" : "planDetails")}</p>
        <h2 data-plan-panel-heading tabIndex={-1}>{formatDay(day, { weekday: "long", day: "numeric", month: "long" }, language)}</h2></div>
      <button type="button" className="icon-button" onClick={close} aria-label={t("planClose")}><X size={18} /></button>
    </div>
    <p className="small muted">{number.format(date.day)} {planMonth(date.month, language)} {number.format(date.year)}</p>
    {events.length ? <ul className="plan-desk-list" onKeyDown={moveListFocus}>{events.map(event => <li key={event.id}>
      <button className="plan-desk-row" type="button" onClick={trigger => open(trigger, event, day)}>
        <strong>{planEventLabels(event, language)[0]}</strong><span className="plan-desk-badge" data-confirmed={event.confirmed}>
          {t(event.confirmed ? "confirmedDate" : "expectedDate")}
        </span>
      </button>
    </li>)}</ul> : <p className="small muted">{t("planDeskNoEvents")}</p>}
    {friday && <div className="plan-desk-jumuah-card compact-stack">
      <strong>{t("planDeskJumuah")}</strong>
      {mosque?.jumuah?.prayer ? <p>{mosque.name} · {mosqueClock(mosque.jumuah.prayer, language)}</p> :
        <Link to="/plan/mosques" className="text-button">{t("planDeskJumuahPending")}</Link>}
    </div>}
    <h3>{t("prayerTimes")}</h3>
    <dl className="plan-desk-prayer-times">
      {prayerIds.map(id => <div key={id}><dt>{t(id)}</dt><dd>{Number.isFinite(times[id].valueOf()) ? formatTime(times[id], settings.city.timeZone, language) : "—"}</dd></div>)}
    </dl>
  </section>;
}

export function DesktopPlan({ today, now, settings, config, mosques, hawl, saved, exportCalendar, saveCalendar, confirmEvent }: PlanProps) {
  const { t, language } = useCopy();
  const wide = useDesktop(1280);
  const [query, setQuery] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>();
  const pane = useRef<HTMLElement>();
  const detailButton = useRef<HTMLButtonElement>();
  const focus = useRef<HTMLElement>();
  const { hijriAdjust, city } = settings;
  const number = new Intl.NumberFormat(language, { useGrouping: false });
  const month = readCalendarMonth(query.get("month"), today);
  const selectedDate = readCalendarDay(query.get("day"), today);
  const eventId = query.get("event");
  const event = eventId ? calendarEventById(eventId, hijriAdjust, config) : undefined;
  const hasDetail = Boolean(selectedDate || event);
  const { first, last } = gregorianMonthBounds(month);
  const displayMonth = formatDay(first, { month: "long", year: "numeric" }, language);
  const firstWeekday = calendarWeekStart(language, city.timeZone, navigator.languages);
  const cells = useMemo(() => gregorianMonthCells(month, firstWeekday, hijriAdjust, config), [month, firstWeekday, hijriAdjust, config]);
  const friday = fridayMosque(mosques)?.jumuah?.prayer;
  const fridayTime = friday && mosqueClock(friday, language, true);
  const district = city.timeZone === "Asia/Dhaka";
  const hijri = hijriOn(today, hijriAdjust, config.anchors);
  const moonStarts = monthStartsInRange(first, last, hijriAdjust, config);
  const moon = moonStarts.find(start => start.dates.some(day => day >= today)) ?? moonStarts.at(-1) ??
    monthStartEvent(hijri.year + Number(hijri.month === 12), hijri.month % 12 + 1, hijriAdjust, config);
  const watchDay = moonWatchDay(moon.year, moon.month, hijriAdjust, config.anchors);
  const watchNow = watchDay === today && now >= schedule(today, city, settings.method, settings.school).maghrib;
  const from = first > today ? first : today;
  const upcoming = useMemo(() => calendarEvents(from, addDays(from, 365), hijriAdjust, config).filter(item => item.kind !== "weekly"),
    [from, hijriAdjust, config]);
  const eid = upcoming.find(item => item.title === "Eid al-Fitr" || item.title === "Eid al-Adha");
  const dayEvents = selectedDate && (cells.find(cell => cell.day === selectedDate)?.events ?? calendarDayEvents(selectedDate, hijriAdjust, config));

  function select(next: { day?: string; event?: string }, replace = false) {
    const params = new URLSearchParams();
    if (month !== calendarMonthOn(today)) params.set("month", month);
    if (next.day) params.set("day", next.day);
    if (next.event) params.set("event", next.event);
    setQuery(params, { replace });
  }

  function closeSelection() {
    select({}, true);
    if (wide) requestAnimationFrame(restoreFocus);
  }

  function restoreFocus() {
    if (focus.current?.isConnected) focus.current.focus({ preventScroll: true });
    else (detailButton.current ?? pane.current?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
  }

  function rememberFocus(trigger: MouseEvent<HTMLElement>) {
    if (wide || !pane.current?.contains(trigger.currentTarget)) focus.current = trigger.currentTarget;
  }

  function openEvent(trigger: MouseEvent<HTMLElement>, selected: CalendarEvent, date?: string, source?: string) {
    rememberFocus(trigger);
    setSelectedSource(source);
    select({ event: selected.id, day: date });
  }

  function changeMonth(next: string) {
    setQuery(next === calendarMonthOn(today) ? {} : { month: next }, { replace: true });
  }

  useEffect(() => {
    if (hasDetail) pane.current?.querySelector<HTMLElement>("[data-plan-panel-heading]")?.focus({ preventScroll: true });
  }, [wide, selectedDate, eventId, hasDetail]);

  const panels = event ? <EventSheet key={event.id + (selectedDate ?? "")} event={event} settings={settings} config={config} mosques={mosques}
    presentation="panel" initialDate={selectedDate} initialSource={selectedSource} onClose={closeSelection} onRestoreFocus={restoreFocus}
    onConfirm={(date, source, moveAfter) => confirmEvent(event, date, source, moveAfter)}
    onMoonReminder={enabled => saveCalendar(old => ({ ...old, moonReminders: { ...old.moonReminders, [event.id]: enabled } }))} />
    : selectedDate ? <DayDetails day={selectedDate} events={dayEvents ?? []} today={today} settings={settings} config={config} mosques={mosques}
      open={openEvent} close={closeSelection} />
    : <>
      <MoonCard event={moon} config={config} district={district} open={openEvent} watchNow={watchNow}
        shift={step => void saveCalendar(old => shiftPlanEvent(old, moon.id, step))} />
      <UpcomingCard events={upcoming.filter(event => event.id !== moon.id)} hawl={hawl} today={today} open={openEvent} />
      <EidCard event={eid} mosques={mosques} open={openEvent} />
    </>;

  return <div className="plan-desktop" data-wide={wide} onKeyDown={key => {
    if (wide && hasDetail && key.key === "Escape" && !key.defaultPrevented) { key.preventDefault(); closeSelection(); }
  }}>
    <section className="card plan-desk-calendar" aria-label={t("planTitle")}>
      <header className="plan-desk-calendar-header">
        <h2>{displayMonth}</h2>
        <div className="plan-desk-toolbar">
          <button type="button" className="icon-button" aria-label={t("planPrevGregorian")} disabled={month <= calendarMonthOn(today, -48)}
            onClick={() => changeMonth(calendarMonthOn(month, -1))}><ChevronLeft size={16} className="icon-dir" /></button>
          <button type="button" className="action light" onClick={() => changeMonth(calendarMonthOn(today))}>{t("today")}</button>
          <button type="button" className="icon-button" aria-label={t("planNextGregorian")} disabled={month >= calendarMonthOn(today, 48)}
            onClick={() => changeMonth(calendarMonthOn(month, 1))}><ChevronRight size={16} className="icon-dir" /></button>
          <button type="button" className="action soft" onClick={exportCalendar}>{t("planExportCalendar")}</button>
          {!wide && <button type="button" className="action light" aria-haspopup="dialog" ref={detailButton} onClick={trigger => {
            rememberFocus(trigger); setDrawer(true);
          }}>{t("planDetails")}</button>}
        </div>
      </header>
      <div className="plan-desk-month">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays("2026-11-15", (firstWeekday + i) % 7);
          return <span className="caption" key={day} aria-label={formatDay(day, { weekday: "long" }, language)}>
            {formatDay(day, { weekday: "short" }, language)}
          </span>;
        })}
        {cells.map(cell => <div key={cell.day} className="plan-desk-cell" data-adjacent={cell.adjacent} data-today={cell.day === today}
          data-selected={cell.day === selectedDate} data-day={cell.day}>
          <button className="plan-desk-day" type="button" aria-current={cell.day === today ? "date" : undefined}
            aria-describedby={"plan-day-" + cell.day}
            onClick={trigger => { rememberFocus(trigger); select({ day: cell.day }); }}>
            <strong>{number.format(Number(cell.day.slice(-2)))}</strong>{" "}<span>
              {number.format(cell.hijri.day)}{cell.hijri.day === 1 && " " + planMonth(cell.hijri.month, language)}
            </span>
          </button>
          <span hidden id={"plan-day-" + cell.day}>
            {formatDay(cell.day, { weekday: "long", day: "numeric", month: "long" }, language)} ·
            {" "}{number.format(cell.hijri.day)} {planMonth(cell.hijri.month, language)}
          </span>
          {cell.events.map(item => {
            const title = isWhiteDays(item) ? t("planDeskWhiteDay") : planEventLabels(item, language)[0];
            const alternate = !isWhiteDays(item) && !item.confirmed && item.dates[1] === cell.day;
            const secondChoice = item.hijriDay === 1 && !item.title.startsWith("Eid")
              ? t("planDeskAlternateStart", { month: planMonth(item.month, language), day: item.hijriDay })
              : t("planDeskAlternate", { event: title });
            return <button className="plan-desk-grid-event" key={item.id} type="button"
              data-kind={isWhiteDays(item) ? "white-days" : item.confirmed ? "confirmed" : "expected"}
              onClick={trigger => openEvent(trigger, item, cell.day)}>
              {alternate ? secondChoice : title}{!item.confirmed && " ~"}
            </button>;
          })}
          {cell.weekday === 5 && <small className="plan-desk-jumuah muted">{t("planDeskJumuah")}{fridayTime && " " + fridayTime}</small>}
        </div>)}
      </div>
      <p className="small muted">{t("planDeskFootnote")}</p>
      {saved && <p role="status" className="plan-desk-saved small">{t("planSaved")}</p>}
    </section>
    {wide ? <aside className="plan-desk-side" ref={pane} aria-label={t("planDetails")}>{panels}</aside> :
      <Dialog open={drawer || hasDetail} onOpenChange={open => { if (!open) { setDrawer(false); closeSelection(); } }}>
        <DialogContent className="awwab-dialog desktop-detail-drawer plan-desk-drawer" overlayClassName="desktop-detail-overlay" showCloseButton={false} aria-describedby={undefined}
          onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
          <div className="row-between">
            <DialogTitle>{t("planDetails")}</DialogTitle>
            <DialogClose asChild><button type="button" className="icon-button" aria-label={t("planClose")}><X size={18} /></button></DialogClose>
          </div>
          <div className="plan-desk-side" ref={element => { pane.current = element; }}>{panels}</div>
        </DialogContent>
      </Dialog>}
  </div>;
}
