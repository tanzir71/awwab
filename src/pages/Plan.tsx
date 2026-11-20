import { useMemo, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { DesktopPlan } from "@/components/DesktopPlan";
import { EventSheet, SightingOptions } from "@/components/PlanEventSheet";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { crescentReminder, eventReminders, prayerReminders, saveCalendar } from "@/lib/calendarFile";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, calendarEventById, calendarEvents, dayDifference, hijriOn, monthStart,
  moonWatchDay, possibleMonthStarts, type CalendarEvent, type CalendarSettings, type MonthAnchor } from "@/lib/hijri";
import { mosqueDefaults } from "@/lib/mosques";
import { shiftPlanEvent } from "@/lib/plan-calendar";
import { planAuthorities, planEventLabels, planMonth } from "@/lib/plan-copy";
import { getRecord, updateRecord, type Settings } from "@/lib/storageService";
import { zakatHawl, type ZakatProfile } from "@/lib/zakat";

const beforeMoon = ["First ten days", "Last ten nights / Laylat al-Qadr", "Six fasts of Shawwāl window"];

function startMonth(config: CalendarSettings, anchor: MonthAnchor) {
  return { ...config, sightingSource: anchor.source, anchors: [...config.anchors.filter(item => item.year !== anchor.year || item.month !== anchor.month), anchor] };
}

function compactDates(dates: string[], locale: string, separator: string) {
  const short = { weekday: "short", day: "numeric" } as const;
  const last = dates[dates.length - 1];
  return dates.map(date => formatDay(date, { ...short, month: date !== last && date.slice(0, 7) === last.slice(0, 7) ? undefined : "short" }, locale)).join(separator);
}

export function Plan({ settings, now, desktop }: { settings: Settings; now: Date; desktop: boolean }) {
  const { t, language, locale } = useCopy();
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const [query, setQuery] = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [panel, setPanel] = useState<"authority" | "month">();
  const [chosenMonthDate, chooseMonthDate] = useState("");
  const [chosenSource, chooseSource] = useState("");
  const [newCalendar, setNewCalendar] = useState(false);
  const [saving, setSaving] = useState(false);
  const focus = useRef<HTMLElement>();
  const config = useRecord("calendar", calendarDefaults);
  const mosques = useRecord("mosques", mosqueDefaults);
  const zakat = useRecord<ZakatProfile | null>("zakat", null);
  const { hijriAdjust: adjustment } = settings;
  const day = dateKey(now, settings.city.timeZone);
  const hawl = zakatHawl(day, zakat, adjustment, config.anchors);
  const hijri = hijriOn(day, adjustment, config.anchors);
  const displayedOrdinal = hijri.year * 12 + hijri.month - 1 + monthOffset;
  const displayYear = Math.floor(displayedOrdinal / 12);
  const displayMonth = displayedOrdinal % 12 + 1;
  const displayStart = monthStart(displayYear, displayMonth, adjustment, config.anchors);
  const displayNext = monthStart(Math.floor((displayedOrdinal + 1) / 12), (displayedOrdinal + 1) % 12 + 1, adjustment, config.anchors);
  const displayLength = displayNext.confirmed ? dayDifference(displayNext.date, displayStart.date) : 30;
  const before = new Date(displayStart.date + "T12:00:00Z").getUTCDay();
  const monthTitle = `${planMonth(displayMonth, language)} ${number.format(displayYear)}`;
  const displayEnd = addDays(displayStart.date, displayLength - 1);
  const monthLabel = displayStart.date.slice(0, 7) === displayEnd.slice(0, 7)
    ? formatDay(displayEnd, { month: "short", year: "numeric" }, locale)
    : `${formatDay(displayStart.date, { month: "short", year: displayStart.date.slice(0, 4) === displayEnd.slice(0, 4) ? undefined : "numeric" }, locale)} – ${formatDay(displayEnd, { month: "short", year: "numeric" }, locale)}`;
  const nextMonth = hijri.month % 12 + 1;
  const nextYear = hijri.year + Number(nextMonth === 1);
  const nextName = planMonth(nextMonth, language);
  const monthDates = possibleMonthStarts(nextYear, nextMonth, adjustment, config.anchors);
  const watchDate = moonWatchDay(nextYear, nextMonth, adjustment, config.anchors);
  const watch = crescentReminder(watchDate, settings, nextYear, nextMonth);
  const watchNow = day === watchDate && watch?.start instanceof Date && now >= watch.start;
  const source = config.sightingSource ?? planAuthorities[0].value;
  const district = settings.city.timeZone === "Asia/Dhaka";
  const sourceLabel = planAuthorities.find(item => item.value === source)?.label;

  const events = useMemo(() => desktop ? [] : calendarEvents(day, addDays(day, expanded ? 365 : 185), adjustment, config)
    .filter(event => event.kind !== "weekly" && event.hijriMonth !== 0 && (expanded || !beforeMoon.includes(event.title))),
  [day, expanded, adjustment, config, desktop]);
  const gridEvents = useMemo(() => desktop ? [] : calendarEvents(displayStart.date, displayEnd, adjustment, config)
    .filter(event => event.kind !== "weekly"),
  [displayStart.date, displayEnd, adjustment, config, desktop]);
  const eventId = query.get("event");
  const selected = eventId ? calendarEventById(eventId, adjustment, config) : undefined;
  const dateLabel = (date: string) => formatDay(date, { weekday: "short", day: "numeric", month: "short" }, locale);

  function exportCalendar(calendar: CalendarSettings) {
    saveCalendar([...prayerReminders(day, settings, 30, 5), ...eventReminders(day, settings, calendar)]);
  }

  async function save(change: (old: CalendarSettings) => CalendarSettings) {
    try {
      await updateRecord("calendar", calendarDefaults, change);
      exportCalendar(await getRecord("calendar", calendarDefaults));
      setNewCalendar(true);
      return true;
    } catch {
      toast.error(t("planSaveError"));
      return false;
    }
  }

  async function submitPanel() {
    setSaving(true);
    const saved = await save(old => panel === "authority" ? { ...old, sightingSource: chosenSource }
      : startMonth(old, { year: nextYear, month: nextMonth, date: chosenMonthDate, source: chosenSource }));
    setSaving(false);
    if (saved) setPanel(undefined);
  }

  function openPanel(event: MouseEvent<HTMLElement>, next: "authority" | "month", date = monthDates[0]) {
    focus.current = event.currentTarget;
    chooseMonthDate(date);
    chooseSource(source);
    setPanel(next);
  }

  function openEvent(event: MouseEvent<HTMLElement>, id: string) {
    focus.current = event.currentTarget;
    setQuery({ event: id });
  }

  function confirmEvent(event: CalendarEvent, date: string, authority: string, moveAfter: boolean) {
    return save(old => {
      if (event.hijriDay === 1 && moveAfter) {
        const overrides = { ...old.overrides };
        delete overrides[event.id];
        return { ...startMonth(old, { year: event.year, month: event.month, date, source: authority }), overrides };
      }
      return { ...old, sightingSource: authority, overrides: { ...old.overrides, [event.id]: { date, source: authority, adjust: 0 } } };
    });
  }

  if (desktop) return <DesktopPlan today={day} now={now} settings={settings} config={config} hawl={hawl} mosques={mosques} saved={newCalendar}
    exportCalendar={() => { exportCalendar(config); setNewCalendar(false); }} saveCalendar={save} confirmEvent={confirmEvent} />;

  return <div className="plan-page">
    <header className="plan-heading row-between">
      <div>
        <p className="caption">{monthLabel}</p>
        <h1 aria-label={t("planTitle") + " · " + monthTitle}>{monthTitle}</h1>
      </div>
      <button type="button" className="plan-sighting" aria-haspopup="dialog"
        onClick={event => openPanel(event, "authority")}>
        {district && source === planAuthorities[0].value ? t("planSightingBd") : sourceLabel ? t(sourceLabel) : source}
        <span className="sr-only"> · {t("planSighting")}</span>
      </button>
    </header>

    {monthDates.length > 1 && <section className="night plan-moon-card" aria-label={t("planMoonWatch")}>
      <p className="caption with-icon"><DesignIcon name="plan-moon" size={18} />{t("planMoonWatch")}</p>
      <h2>{watchNow ? t("planSeen") : t("planStarts", { month: nextName, dates: compactDates(monthDates, locale, t("planOr")) })}</h2>
      <p className="muted small">{watchNow ? t("planSeenDetail", { month: nextName }) : t("planWatchDetail", { date: dateLabel(watchDate) })}</p>
      <div className="equal-row">
        {watchNow ? <button className="action plan-moon-primary" onClick={event => openPanel(event, "month", monthDates[0])}>{t("planTomorrow")}</button>
          : <button className="action plan-moon-primary" onClick={() => {
            if (watch) saveCalendar([watch], "awwab-moon-watch.ics");
            else toast.error(t("planWatchUnavailable"));
          }}>{t("planWatchReminder", { day: formatDay(watchDate, { weekday: "short" }, locale) })}</button>}
        <button className="action light" onClick={event => openPanel(event, "month", watchNow ? monthDates[1] : monthDates[0])}>
          {t(watchNow ? "planCompleteThirty" : "planItConfirmed")}
        </button>
      </div>
    </section>}

    <section className="card plan-month" aria-label={monthTitle}>
      <div className="month-grid">
        {Array.from({ length: 7 }, (_, i) => {
          const weekday = addDays("2026-11-15", i);
          return <small key={weekday} className="plan-weekday muted" aria-label={formatDay(weekday, { weekday: "long" }, locale)}>
            {formatDay(weekday, { weekday: "narrow" }, locale)}
          </small>;
        })}
        {Array.from({ length: before }, (_, i) => <span key={i} />)}
        {Array.from({ length: displayLength }, (_, i) => {
          const date = addDays(displayStart.date, i);
          const event = gridEvents.find(event => (event.hijriMonth || i === 12) && event.dates.includes(date)
            && (event.hijriMonth || event.month === displayMonth));
          const kind = date === day ? "current" : i >= 12 && i <= 14 ? "white-days" : i === 29 && !displayNext.confirmed ? "expected" : "";
          const label = `${number.format(i + 1)} ${planMonth(displayMonth, language)} · ${dateLabel(date)}`;
          const content = <><strong>{number.format(i + 1)}{kind === "expected" && "?"}</strong><small>{number.format(Number(date.slice(-2)))}</small></>;
          return <div className="month-day" key={date} data-kind={kind} data-event={!!event} title={label}>
            {event ? <button aria-haspopup="dialog" onClick={click => openEvent(click, event.id)}>{content}<span className="sr-only"> · {label} · {planEventLabels(event, language, t)[0]}</span></button>
              : <span aria-current={date === day ? "date" : undefined}><span className="sr-only">{label}</span><span aria-hidden="true">{content}</span></span>}
          </div>;
        })}
      </div>
      <div className="plan-month-footer">
        <ul className="plan-legend">
          <li data-kind="current">{t("today")}</li><li data-kind="white-days">{t("planWhiteDays")}</li><li data-kind="expected">{t("planDependsOnMoon")}</li>
        </ul>
        <div className="plan-month-navigation">
          <button className="icon-button" aria-label={t("planPrevMonth")} onClick={() => setMonthOffset(value => Math.max(-48, value - 1))} disabled={monthOffset === -48}><ChevronLeft className="icon-dir" size={17} /></button>
          {monthOffset !== 0 && <button className="text-button" onClick={() => setMonthOffset(0)}>{t("planCurrentMonth")}</button>}
          <button className="icon-button" aria-label={t("planNextMonth")} onClick={() => setMonthOffset(value => Math.min(48, value + 1))} disabled={monthOffset === 48}><ChevronRight className="icon-dir" size={17} /></button>
        </div>
      </div>
    </section>

    {newCalendar && <p className="card soft small" role="status">{t("planSaved")}</p>}
    <section className="plan-upcoming">
      <div className="row-between"><h2>{t("planUpcoming")}</h2>
        <button className="text-button" onClick={() => { exportCalendar(config); setNewCalendar(false); }}>{t("planAddCalendar")}</button>
      </div>
      <div className="compact-stack">
        {(expanded ? events : events.slice(0, 5)).map(event => {
          const [title, detail] = planEventLabels(event, language, t);
          const status = event.confirmed ? "confirmedDate" : event.kind === "follows-month" ? "planFollowsMonth" : "expectedDate";
          const dates = compactDates(event.dates, locale, t("planOr"));
          const offset = config.overrides[event.id]?.adjust ?? 0;
          return <article className="card plan-event-card" key={event.id}>
            <button className="plan-open-event" aria-haspopup="dialog" onClick={click => openEvent(click, event.id)}>
              <span>{title}</span><strong>{dates}</strong><small className="muted">{detail}</small>
            </button>
            <div className="plan-event-side">
              <span className="plan-event-badge caption" data-kind={status}>{t(status)}</span>
              <small>{t("planDaysAway", { count: Math.max(0, dayDifference(event.dates[0], day)) })}</small>
              <div className="plan-adjust">
                {([-1, 1] as const).map(step => <button key={step} aria-pressed={offset === step}
                  onClick={() => void save(old => shiftPlanEvent(old, event.id, step))}>
                  <span>{step < 0 ? "−" : "+"}{number.format(1)}</span><span className="sr-only"> {t(step < 0 ? "planAdjustEarlier" : "planAdjustLater", { event: title })}</span></button>)}
              </div>
            </div>
          </article>;
        })}
      </div>
    </section>

    <nav className="plan-tools equal-row" aria-label={t("tools")}>
      <Link className="card" to="/plan/mosques"><span className="icon-box"><DesignIcon name="plan-pin" /></span><strong>{t("mosques")}</strong><small className="muted">{t("planMosquesSaved", { count: mosques.mosques.length })}</small></Link>
      <Link className="card" to="/plan/zakat"><span className="icon-box"><DesignIcon name="plan-coins" /></span><strong>{t("zakat")}</strong><small className="muted">{hawl ? `${number.format(hawl.day)} ${planMonth(hawl.month, language)}` : t("planZakatDetail")}</small></Link>
      <Link className="card" to="/umrah"><span className="icon-box"><DesignIcon name="plan-cube" /></span><strong>{t("planUmrah")}</strong><small className="muted">{t("planUmrahDetail")}</small></Link>
    </nav>
    <Link className="action soft" to="/plan/umrah-guide">{t("umrahPracticeOpen")}</Link>
    <div className="row-between plan-more">
      <Link className="text-button" to="/you/hijri">{t("planTitle")} · {t("settings")}</Link>
      <button className="text-button" onClick={() => setExpanded(value => !value)}>{t(expanded ? "planSeeFewer" : "planSeeYear")}</button>
    </div>

    <Dialog open={!!panel} onOpenChange={open => { if (!open && !saving) setPanel(undefined); }}>
      {panel && <DialogContent className="awwab-dialog plan-confirm-dialog" showCloseButton={false} aria-describedby={undefined}
        onCloseAutoFocus={event => { event.preventDefault(); focus.current?.focus(); }}>
        <div className="row-between"><DialogTitle>{panel === "month" ? t("planSeenDetail", { month: nextName }) : t("planSighting")}</DialogTitle>
          <DialogClose asChild><button className="icon-button" aria-label={t("planClose")}><X size={20} /></button></DialogClose>
        </div>
        {panel === "month" && <div className="equal-row plan-date-choices" role="group" aria-label={t("planWhichDay")}>
          {monthDates.map(date => <button className="plan-date-choice" aria-pressed={date === chosenMonthDate} key={date} onClick={() => chooseMonthDate(date)}>{dateLabel(date)}</button>)}
        </div>}
        <SightingOptions source={chosenSource} setSource={chooseSource} district={district} />
        <button className="action" disabled={saving} onClick={() => void submitPanel()}>{t(panel === "month" ? "planConfirm" : "planUseSource")}</button>
      </DialogContent>}
    </Dialog>
    {selected && <EventSheet key={selected.id} event={selected} settings={settings} config={config} mosques={mosques}
      onClose={() => setQuery({}, { replace: true })} onRestoreFocus={() => focus.current?.focus()}
      onConfirm={(date, authority, moveAfter) => confirmEvent(selected, date, authority, moveAfter)}
      onMoonReminder={enabled => save(old => ({ ...old, moonReminders: { ...old.moonReminders, [selected.id]: enabled } }))} />}
  </div>;
}
