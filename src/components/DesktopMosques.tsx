import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useDesktop } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { mosqueNoticeLabel, mosqueOccasionLabel, mosqueRoleLabel, mosqueSourceLabel } from "@/lib/mosque-copy";
import { assignedMosque, mosqueAdhanOffset, mosqueCheckedAge, mosqueClock, timetableNotice, type Mosque, type MosqueOccasion, type MosquePlan } from "@/lib/mosques";
import { calendarWeekStart } from "@/lib/plan-calendar";
import { prayerIds } from "@/types/Prayer";
import { MosqueBoardPhoto, MosqueTime, type MosquePanel } from "./MosqueEditors";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./ui/dialog";

type Occasion = { mosque: Mosque; entry: MosqueOccasion; target: number };
type OpenEditor = (trigger: MouseEvent<HTMLElement>, panel: MosquePanel) => void;
type MosqueDetailsProps = {
  mosque: Mosque; occasions: Occasion[]; zone: string; open: OpenEditor; check: (id: string) => Promise<boolean>;
};

function moveRowFocus(event: KeyboardEvent<HTMLTableSectionElement>) {
  if ((event.key !== "j" && event.key !== "k") || event.altKey || event.ctrlKey || event.metaKey) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".mosque-desk-select")];
  const index = buttons.findIndex(item => item === event.target);
  if (index < 0) return;
  event.preventDefault();
  buttons[(index + (event.key === "j" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
}

function MosqueDetails({ mosque, occasions, zone, open, check }: MosqueDetailsProps) {
  const { t, locale } = useCopy();
  const [pending, setPending] = useState(false);
  const clock = (time: string) => mosqueClock(time, locale, true);
  const date = mosque.photoSavedAt ? formatDay(dateKey(new Date(mosque.photoSavedAt), zone), { day: "numeric", month: "short" }, locale) : undefined;
  const caption = mosque.photo ? t("mosqueDeskBoard") + (date ? " · " + date : "") : t("mosqueDeskAddPhoto");
  const relevant = occasions.filter(item => item.mosque.id === mosque.id);
  const friday = mosque.jumuah;
  const fridayLabels = [
    friday?.khutbah && t("mosqueDeskKhutbah", { time: clock(friday.khutbah) }),
    friday?.prayer && t("mosqueDeskFridayPrayer", { time: clock(friday.prayer) }),
  ].filter(Boolean);
  const number = new Intl.NumberFormat(locale, { useGrouping: false });

  return <section className="card compact-stack mosque-desk-detail" aria-label={t("mosqueDeskDetail")}>
    <div className="row-between">
      <h2><bdi>{mosque.name}</bdi></h2>
      <button type="button" className="text-button" aria-haspopup="dialog" onClick={trigger => open(trigger, { kind: "timetable", mosque })}>{t("qadaEdit")}</button>
    </div>
    <p className="small muted">{t(mosqueRoleLabel[mosque.role])} · {t(mosqueSourceLabel[mosque.source])}</p>
    <button type="button" className="mosque-desk-board" aria-haspopup="dialog" onClick={trigger => open(trigger, { kind: "photo", id: mosque.id })}>
      <MosqueBoardPhoto mosque={mosque} className="mosque-desk-board-image" />
      <span>{caption}</span>
    </button>
    {(prayerIds.some(id => mosque.jamaat[id]) || fridayLabels.length > 0) && <dl className="mosque-desk-times">
      {prayerIds.filter(id => mosque.jamaat[id]).map(id => <div key={id}><dt>{t(id)}</dt><dd><MosqueTime time={mosque.jamaat[id]} /></dd></div>)}
      {fridayLabels.length > 0 && <div><dt>{t("mosqueJumuah")}</dt><dd>{fridayLabels.join(" · ")}</dd></div>}
    </dl>}
    {relevant.map(({ entry, target }) => {
      const period = entry.year === target ? t("planEidThisYear") : entry.year === target - 1 ? t("planEidLastYear") : number.format(entry.year);
      return <button type="button" className="mosque-desk-occasion" key={entry.type} aria-haspopup="dialog"
        onClick={trigger => open(trigger, { kind: "occasion", id: mosque.id, occasion: entry.type })}>
        <span className="caption">{t(mosqueOccasionLabel[entry.type])} · {period}</span>
        <strong>{entry.times.map(time => mosqueClock(time, locale)).join(" · ")}</strong>
      </button>;
    })}
    {relevant.length === 0 && <button type="button" className="text-button mosque-desk-add-occasion" aria-haspopup="dialog"
      onClick={trigger => open(trigger, { kind: "occasion", id: mosque.id })}>{t("mosqueDeskEidTimes")}</button>}
    <button className="action mosque-desk-check" type="button" disabled={pending} onClick={async () => {
      if (pending) return;
      setPending(true);
      try {
        if (await check(mosque.id)) toast.success(t("mosqueDeskCheckedSaved"));
      } finally {
        setPending(false);
      }
    }}>{t("mosqueDeskCheckedToday")}</button>
  </section>;
}

function WeekMatrix({ plan, zone, open }: { plan: MosquePlan; zone: string; open: OpenEditor }) {
  const { t, language, locale } = useCopy();
  const first = calendarWeekStart(language, zone, navigator.languages);
  const days = Array.from({ length: 7 }, (_, i) => (first + i) % 7);
  const dates = days.map(day => addDays("2026-11-15", day));
  return <section className="card compact-stack mosque-desk-week">
    <div className="row-between">
      <h2>{t("mosqueDeskWhere")}</h2>
      <button className="text-button" type="button" aria-haspopup="dialog" onClick={trigger => open(trigger, { kind: "mapping" })}>{t("mosqueDeskPlanEdit")}</button>
    </div>
    <table aria-label={t("mosqueDeskWhere")}>
      <thead><tr><th scope="col"><span className="sr-only">{t("mosqueDeskPrayer")}</span></th>
        {dates.map(day => <th scope="col" key={day} className="caption">{formatDay(day, { weekday: "short" }, locale)}</th>)}
      </tr></thead>
      <tbody>{prayerIds.map(id => <tr key={id}>
        <th scope="row">{t(id)}</th>
        {days.map((day, index) => {
          const mosque = assignedMosque(day, id, plan);
          const role = mosque?.role;
          const label = role ? t(mosqueRoleLabel[role]) : t("mosqueDeskUnassigned");
          const otherSameRole = role && plan.mosques.some(other => other.id !== mosque.id && other.role === role);
          return <td key={day}>
            <button className="mosque-desk-assignment" data-role={role} type="button" aria-haspopup="dialog"
              title={mosque?.name} aria-describedby={"mosque-assignment-" + id + "-" + day}
              onClick={trigger => open(trigger, { kind: "mapping", id, day })}>{otherSameRole ? mosque.name : label}</button>
            <span id={"mosque-assignment-" + id + "-" + day} hidden>
              {t(id)} · {formatDay(dates[index], { weekday: "long" }, locale)} · {mosque?.name ?? t("mosqueUnmapped")}
            </span>
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </section>;
}

export function DesktopMosques({ plan, today, zone, season, occasions, selectedId, selectMosque, openEditor, addMosque, check, nearby }: {
  plan: MosquePlan; today: string; zone: string; season?: "eid" | "ramadan"; occasions: Occasion[];
  selectedId?: string; selectMosque: (id: string) => void; openEditor: OpenEditor; addMosque: (trigger: MouseEvent<HTMLElement>) => void;
  check: (id: string) => Promise<boolean>; nearby: ReactNode;
}) {
  const { t, language, locale } = useCopy();
  const wide = useDesktop(1280);
  const [drawer, setDrawer] = useState(false);
  const opener = useRef<HTMLButtonElement>();
  const selected = plan.mosques.find(mosque => mosque.id === selectedId) ?? plan.mosques[0];
  const rows = plan.mosques.map(mosque => {
    const checked = dateKey(new Date(mosque.updatedAt), zone);
    return { mosque, checked, notice: timetableNotice(today, checked, mosque.refreshMonth, season) };
  });
  const stale = rows.find(row => row.notice && row.mosque.id === selected?.id) ?? rows.find(row => row.notice);
  // On an empty device, a matrix cell leads straight to the mosque form.
  const open: OpenEditor = (trigger, panel) => {
    if (panel.kind === "mapping" && !plan.mosques.length) addMosque(trigger);
    else openEditor(trigger, panel);
  };
  const detail = selected && <MosqueDetails key={selected.id} mosque={selected} occasions={occasions}
    zone={zone} open={open} check={check} />;

  return <div className="mosque-desktop" data-wide={wide}>
    <div className="mosque-desk-list">
      <section className="card compact-stack mosque-desk-saved">
        <div className="row-between">
          <h2>{t("mosqueDeskList")}</h2>
          <button type="button" className="text-button" aria-haspopup="dialog" onClick={addMosque}>+ {t("mosqueAddFull")}</button>
        </div>
        {rows.length ? <table aria-label={t("mosqueSaved")}>
          <thead><tr>
            <th scope="col">{t("mosqueDeskName")}</th><th scope="col">{t("mosqueRole")}</th>
            {prayerIds.map(id => <th scope="col" key={id}>{id === "maghrib" && language !== "en"
              ? <abbr title={t(id)}>{t("mosqueMaghShort")}</abbr> : t(id)}</th>)}
            <th scope="col">{t("mosqueDeskChecked")}</th>
          </tr></thead>
          <tbody onKeyDown={moveRowFocus}>{rows.map(({ mosque, checked, notice }) => <tr key={mosque.id} onClick={event => {
            opener.current = event.currentTarget.querySelector<HTMLButtonElement>(".mosque-desk-select");
            selectMosque(mosque.id);
            if (!wide) setDrawer(true);
          }}>
            <th scope="row"><button className="mosque-desk-select" type="button" aria-current={wide && selected?.id === mosque.id ? "true" : undefined}
              aria-haspopup={wide ? undefined : "dialog"}><bdi>{mosque.name}</bdi></button></th>
            <td><span className="mosque-role caption" data-role={mosque.role}>{t(mosqueRoleLabel[mosque.role])}</span></td>
            {prayerIds.map(id => {
              const jumua = id === "dhuhr" && mosque.role === "jumuah" && Boolean(mosque.jumuah?.prayer);
              const time = jumua ? mosque.jumuah.prayer : mosque.jamaat[id];
              return <td key={id} className="mosque-desk-table-time">{time === "adhan+5" ?
                <abbr title={t("mosqueAdhanFiveLong", mosqueAdhanOffset)}>{t("mosqueDeskOffset", mosqueAdhanOffset)}</abbr> :
                <><MosqueTime time={time} />{jumua && <abbr title={t("mosqueJumuah")}> {t("mosqueDeskFridayShort")}</abbr>}</>}
              </td>;
            })}
            <td><time dateTime={checked} data-stale={Boolean(notice)} className="mosque-desk-checked small"
              title={t("mosqueDeskCheckedDate", { date: formatDay(checked, { dateStyle: "long" }, locale) })}>
              {mosqueCheckedAge(today, checked, locale)}{notice && <span className="sr-only"> · {t(mosqueNoticeLabel[notice], {
                month: formatDay(today, { month: "long" }, locale),
              })}</span>}
            </time></td>
          </tr>)}</tbody>
        </table> : <p className="small muted">{t("mosqueEmpty")}</p>}
        {stale && <div className="mosque-desk-alert">
          <span className="mosque-desk-alert-icon" aria-hidden="true" />
          <p>{t("mosqueDeskStaleNotice", {
            mosque: stale.mosque.name, notice: t(mosqueNoticeLabel[stale.notice], { month: formatDay(today, { month: "long" }, locale) }),
          })}</p>
          <a href={"https://wa.me/" + (stale.mosque.contact ?? "") + "?text=" +
            encodeURIComponent(t("mosqueAskGeneral", { mosque: stale.mosque.name }))}
            target="_blank" rel="noopener noreferrer">{t("mosqueWhatsapp")}</a>
        </div>}
      </section>
      <WeekMatrix plan={plan} zone={zone} open={open} />
      {!wide && nearby}
    </div>
    {wide ? <aside className="mosque-desk-side">{detail ?? <section className="card small muted">{t("mosqueEmpty")}</section>}{nearby}</aside> :
      <Dialog open={drawer && Boolean(selected)} onOpenChange={setDrawer}>
        <DialogContent className="awwab-dialog desktop-detail-drawer" overlayClassName="desktop-detail-overlay" showCloseButton={false}
          aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
          <div className="row-between"><DialogTitle>{t("mosqueDeskDetail")}</DialogTitle>
            <DialogClose asChild><button className="icon-button" type="button" aria-label={t("planClose")}><X size={18} aria-hidden="true" /></button></DialogClose></div>
          {detail}
        </DialogContent>
      </Dialog>}
  </div>;
}
