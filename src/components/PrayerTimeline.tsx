import { Fragment } from "react";
import type { Prayer, RakatGroup } from "@/types/Prayer";
import type { Settings } from "@/lib/storageService";
import { message, rakatLabel } from "@/lib/copy";
import { duration, formatTime } from "@/lib/dates";
import { jamaatForPrayer, type MosquePlan } from "@/lib/mosques";
import { guideRakats } from "@/lib/prayerGuide";
import { formatLocale } from "@/lib/languagePreferences";
import { DesignIcon } from "./DesignIcon";

const icons = { upcoming: "clock1", now: "clock", done: "check", late: "check", missed: "ret", qada: "check" };

export function RakatCards({ groups, settings }: { groups: RakatGroup[]; settings: Settings }) {
  const t = message.bind(null, settings);
  const number = new Intl.NumberFormat(formatLocale(settings));
  return <div className="rakat-grid" data-count={groups.length}>
    {groups.map((group, i) => <div data-fard={group.type === "fard"} key={i}>
      <strong><span className="rakat-number">{number.format(group.count)}</span> {rakatLabel(settings, group.type)}</strong>
      <small>{t(group.type === "fard" ? "rakatsObligatory" : group.type === "witr" ? "rakatsWajib" : "rakatsOptional")}</small>
    </div>)}
  </div>;
}

export default function PrayerTimeline({ prayers, settings, now, mosques, onAction }: {
  prayers: Prayer[]; settings: Settings; now: Date; mosques?: MosquePlan; onAction: (prayer: Prayer) => void;
}) {
  const group = settings.mode === "maktab" ? "maktab-today" : "today";
  const t = message.bind(null, settings);
  const zone = settings.city.timeZone;
  const locale = formatLocale(settings);
  const number = new Intl.NumberFormat(locale);
  const jamaatCopy = { locale, afterAdhan: t("mosqueAdhanFiveLong") };
  return <div className="compact-stack prayer-timeline">
    {prayers.map(prayer => {
      const available = Number.isFinite(prayer.starts.valueOf());
      const jamaat = mosques && jamaatForPrayer(prayer, zone, mosques, jamaatCopy);
      const rakats = guideRakats(prayer.rakats, settings);
      const status = prayer.status === "now" ? t("prayerRowNow", { time: duration(prayer.ends.valueOf() - now.valueOf(), locale) }) : t(prayer.status);
      const detail = prayer.status === "missed" ? t("missedEncouragement") : [
        prayer.status !== "upcoming" || !available ? status : undefined,
        jamaat ? t("jamaat", jamaat) : undefined,
      ].filter(Boolean).join(" · ");
      const showRakats = !jamaat && available && (prayer.status === "now" || prayer.status === "upcoming");
      const icon = prayer.status === "missed" && settings.mode === "adult" ? "today-missed" : `${group}-${icons[prayer.status]}`;
      return <button type="button" key={prayer.id} className="list-row prayer-row"
        data-status={prayer.status} onClick={() => onAction(prayer)}>
        <span className="icon-box"><DesignIcon name={icon} size={16} /></span>
        <span><strong>{t(prayer.id)}</strong><small>
          {detail}{detail && showRakats && " · "}
          {showRakats && rakats.map((rakat, i) => <Fragment key={i}>
            {i > 0 && <> <span className="inline-block icon-dir" aria-hidden="true">→</span> </>}
            {number.format(rakat.count)} {rakatLabel(settings, rakat.type)}
          </Fragment>)}
        </small></span>
        {available ? <time dateTime={prayer.starts.toISOString()} aria-label={formatTime(prayer.starts, zone, locale)}>{formatTime(prayer.starts, zone, locale, true)}</time> : <small>{t("unavailable")}</small>}
      </button>;
    })}
  </div>;
}
