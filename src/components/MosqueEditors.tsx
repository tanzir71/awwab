import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCopy } from "@/lib/copy";
import { addDays, formatDay } from "@/lib/dates";
import { mosqueAdhanOffset, mosqueClock, mosqueInputClock, mosqueInputDigits, mosqueOccasions, mosquePhotoLimit, mosquePhotoTypes, mosqueRoles, mosqueSources, parseMosqueClock, weeklyMosque,
  type Mosque, type MosqueOccasion, type MosquePlan } from "@/lib/mosques";
import { mosqueOccasionLabel, mosqueRoleLabel, mosqueSourceLabel } from "@/lib/mosque-copy";
import { prayerIds, type PrayerId } from "@/types/Prayer";

export type MosquePanel = { kind: "timetable"; mosque: Mosque }
  | { kind: "photo"; id: string }
  | { kind: "mapping"; id?: PrayerId; day?: number }
  | { kind: "occasion"; id?: string; occasion?: MosqueOccasion["type"] };

export function MosqueTime({ time }: { time?: string }) {
  const { t, locale } = useCopy();
  if (!time) return <span>—</span>;
  if (time === "adhan+5") return <abbr title={t("mosqueAdhanFiveLong", mosqueAdhanOffset)}>{t("mosqueAdhanFive", mosqueAdhanOffset)}</abbr>;
  const spoken = mosqueClock(time, locale);
  return <time dateTime={time} title={spoken}><bdi aria-hidden="true">{mosqueClock(time, locale, true)}</bdi><span className="sr-only">{spoken}</span></time>;
}

function MosqueTimeField({ name, defaultTime, value, change, disabled, required }: {
  name: string; defaultTime?: string; value?: string; change?: (value: string) => void; disabled?: boolean; required?: boolean;
}) {
  const { t, language, locale } = useCopy();
  const native = language === "en";
  const example = mosqueInputClock("07:30", locale);
  const hint = t("mosqueTimeFormat", { hours: 24, example });
  function validate(input: HTMLInputElement) {
    const valid = input.value.trim() ? Boolean(parseMosqueClock(input.value, locale)) : !required;
    input.setCustomValidity(valid ? "" : hint);
  }
  return <input type={native ? "time" : "text"} dir="ltr" name={name} disabled={disabled} required={required}
    defaultValue={defaultTime && (native ? defaultTime : mosqueInputClock(defaultTime, locale))} value={value}
    inputMode={native ? undefined : "numeric"} placeholder={native ? undefined : example} title={native ? undefined : hint}
    onInvalid={native ? undefined : event => validate(event.currentTarget)}
    onChange={event => {
      if (!native) validate(event.currentTarget);
      change?.(event.currentTarget.value);
    }} />;
}

export function WeekEditor({ prayer, initialDay, plan, week, group, save, cancel }: {
  prayer?: PrayerId; initialDay?: number; plan: MosquePlan; week: readonly number[]; group?: string;
  save: (prayer: PrayerId, days: readonly number[], mosqueId: string) => Promise<boolean>; cancel: () => void;
}) {
  const { t, locale } = useCopy();
  const [selectedPrayer, setPrayer] = useState(prayer ?? prayerIds[0]);
  const [scope, setScope] = useState(initialDay === undefined ? "group" : String(initialDay));
  const [choice, choose] = useState<string>();
  const [pending, setPending] = useState(false);
  const days = scope === "group" ? week : [Number(scope)];
  const existing = weeklyMosque(days, selectedPrayer, plan);
  const mosqueId = choice ?? (existing.differentMosques ? "mixed" : existing.mosque?.id ?? "");
  return <form className="stack" onSubmit={async event => {
    event.preventDefault();
    if (pending || mosqueId === "mixed") return;
    setPending(true);
    await save(selectedPrayer, days, mosqueId);
    setPending(false);
  }}>
    {!prayer && <label className="field">{t("mosqueDeskPrayer")}<select value={selectedPrayer}
      onChange={event => { setPrayer(event.target.value as PrayerId); choose(undefined); }}>
      {prayerIds.map(id => <option key={id} value={id}>{t(id)}</option>)}
    </select></label>}
    <label className="field">{t("mosqueDay")}<select name="day" value={scope} onChange={event => { setScope(event.target.value); choose(undefined); }}>
      <option value="group">{group ? t("mosqueGroupDays", { group }) : t("mosqueDeskEveryDay")}</option>
      {Array.from({ length: 7 }, (_, day) => <option key={day} value={day}>
        {formatDay(addDays("2026-11-15", day), { weekday: "long" }, locale)}
      </option>)}
    </select></label>
    <label className="field">{t("mosqueChoose")}<select name="mosque" value={mosqueId} onChange={event => choose(event.target.value)}>
      {existing.differentMosques && <option value="mixed" disabled>{t("mosqueVaries")}</option>}
      <option value="">{t("mosqueUnmapped")}</option>
      {plan.mosques.map(mosque => <option key={mosque.id} value={mosque.id}>{mosque.name}</option>)}
    </select></label>
    <div className="equal-row">
      <button className="action light" type="button" disabled={pending} onClick={cancel}>{t("mosqueCancel")}</button>
      <button className="action" disabled={pending || mosqueId === "mixed"}>{t("mosqueSaveMapping")}</button>
    </div>
  </form>;
}

export function TimetableEditor({ mosque, save, cancel }: {
  mosque: Mosque; save: (changed: Mosque) => Promise<boolean>; cancel: () => void;
}) {
  const { t, locale } = useCopy();
  const [relativeMaghrib, setRelativeMaghrib] = useState(mosque.jamaat.maghrib === "adhan+5");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    const read = (key: string) => String(values.get(key) ?? "").trim();
    const name = read("name");
    if (!name) { toast.error(t("mosqueNameError")); return; }
    const lat = read("lat"), lon = read("lon");
    if (Boolean(lat) !== Boolean(lon)) { toast.error(t("mosqueCoordError")); return; }
    const time = (key: string) => parseMosqueClock(read(key), locale) ?? "";
    const jamaat = Object.fromEntries(prayerIds.map(id => [id, time(id)]).filter(([, value]) => value));
    if (relativeMaghrib) jamaat.maghrib = "adhan+5";
    setPending(true);
    try {
      await save({
        ...mosque, name, jamaat, role: read("role") as Mosque["role"], source: read("source") as Mosque["source"],
        jumuah: { khutbah: time("khutbah"), prayer: time("jumuah") },
        contact: mosqueInputDigits(read("contact"), locale).replace(/\D/g, "").slice(0, 30),
        refreshMonth: Number(read("refreshMonth")) || undefined,
        location: lat && lon ? { lat: Number(lat), lon: Number(lon) } : undefined,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setPending(false);
    }
  }

  return <form className="stack" onSubmit={submit}>
    <label className="field">{t("mosqueName")}<input name="name" defaultValue={mosque.name} required maxLength={100} /></label>
    <div className="equal-row">
      <label className="field">{t("mosqueRole")}<select name="role" defaultValue={mosque.role}>
        {mosqueRoles.map(role => <option key={role} value={role}>{t(mosqueRoleLabel[role])}</option>)}
      </select></label>
      <label className="field">{t("mosqueSource")}<select name="source" defaultValue={mosque.source}>
        {mosqueSources.map(source => <option key={source} value={source}>{t(mosqueSourceLabel[source])}</option>)}
      </select></label>
    </div>
    <h3>{t("mosqueTimesTitle")}</h3>
    <div className="mosque-time-fields">{prayerIds.map(id => <label className="field" key={id}>{t(id)}
      <MosqueTimeField name={id} defaultTime={mosque.jamaat[id] === "adhan+5" ? undefined : mosque.jamaat[id]} disabled={id === "maghrib" && relativeMaghrib} />
    </label>)}</div>
    <label className="mosque-check"><input type="checkbox" checked={relativeMaghrib} onChange={event => setRelativeMaghrib(event.target.checked)} />{t("mosqueAdhanFiveLong", mosqueAdhanOffset)} · {t("maghrib")}</label>
    <div className="equal-row">
      <label className="field">{t("mosqueKhutbah")}<MosqueTimeField name="khutbah" defaultTime={mosque.jumuah?.khutbah} /></label>
      <label className="field">{t("mosqueJumuahTime")}<MosqueTimeField name="jumuah" defaultTime={mosque.jumuah?.prayer} /></label>
    </div>
    <details className="mosque-more-fields">
      <summary>{t("mosqueOptions")}</summary>
      <div className="stack">
        <label className="field">{t("mosqueRefreshMonth")}<select name="refreshMonth" defaultValue={mosque.refreshMonth ?? ""}>
          <option value="">{t("mosqueNoRefreshMonth")}</option>
          {Array.from({ length: 12 }, (_, i) => <option value={i + 1} key={i}>
            {formatDay(`2026-${String(i + 1).padStart(2, "0")}-01`, { month: "long" }, locale)}
          </option>)}
        </select></label>
        <label className="field">{t("mosqueContact")}<input type="tel" name="contact" maxLength={36} defaultValue={mosque.contact} /></label>
        <div className="equal-row">
          <label className="field">{t("mosqueLat")}<input name="lat" type="number" step="any" min="-90" max="90" defaultValue={mosque.location?.lat} /></label>
          <label className="field">{t("mosqueLon")}<input name="lon" type="number" step="any" min="-180" max="180" defaultValue={mosque.location?.lon} /></label>
        </div>
      </div>
    </details>
    <div className="equal-row"><button type="button" className="action light" disabled={pending} onClick={cancel}>{t("mosqueCancel")}</button>
      <button className="action" disabled={pending}>{t("mosqueSave")}</button></div>
  </form>;
}

export function MosqueBoardPhoto({ mosque, image, className }: {
  mosque: Mosque; image?: Mosque["photo"]; className: string;
}) {
  const { t } = useCopy();
  const [url, setUrl] = useState<string>();
  const source = image ?? mosque.photo;
  useEffect(() => {
    if (source instanceof Blob) {
      const next = URL.createObjectURL(source);
      setUrl(next);
      return () => URL.revokeObjectURL(next);
    }
    setUrl(source);
  }, [source]);
  return url ? <img className={className} src={url} alt={t("mosquePhotoName", { mosque: mosque.name })} /> : null;
}

export function PhotoEditor({ mosque, save }: { mosque: Mosque; save: (photo: Blob) => Promise<boolean> }) {
  const { t } = useCopy();
  const picker = useRef<HTMLInputElement>(null);
  const size = { count: mosquePhotoLimit / 1_000_000 };
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  return <form className="stack" onSubmit={async event => {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    await save(file);
    setPending(false);
  }}>
    <MosqueBoardPhoto mosque={mosque} image={file} className="mosque-board-photo" />
    <p className="muted small">{t("mosquePhotoHint", size)}</p>
    <button className="action light" type="button" onClick={() => picker.current?.click()} disabled={pending}>{t("mosqueChoosePhoto")}</button>
    {file && <p className="mosque-photo-filename small" role="status" dir="auto">{file.name}</p>}
    <input ref={picker} type="file" hidden accept={mosquePhotoTypes.join(",")}
      onChange={event => {
        const chosen = event.currentTarget.files?.[0];
        if (chosen && (!mosquePhotoTypes.includes(chosen.type) || !chosen.size || chosen.size > mosquePhotoLimit)) {
          toast.error(t("mosquePhotoError", size));
          event.currentTarget.value = "";
          setFile(undefined);
        } else setFile(chosen);
      }} />
    <button className="action" disabled={!file || pending}>{t("mosquePhotoSave")}</button>
  </form>;
}

export function OccasionEditor({ mosques, initialMosque, initialType, yearNow, update }: {
  mosques: Mosque[]; initialMosque?: string; initialType?: MosqueOccasion["type"]; yearNow: number;
  update: (id: string, change: (mosque: Mosque) => Mosque) => Promise<boolean>;
}) {
  const { t, locale } = useCopy();
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const [id, setId] = useState(initialMosque ?? mosques[0]?.id ?? "");
  const [type, setType] = useState(initialType ?? "eid_fitr");
  const [time, setTime] = useState("");
  const [yearText, setYearText] = useState(() => number.format(yearNow));
  const [pending, setPending] = useState(false);
  const year = Number(mosqueInputDigits(yearText.trim(), locale));
  const clock = parseMosqueClock(time, locale);
  const mosque = mosques.find(item => item.id === id);
  const records = mosque?.occasional.filter(item => item.type === type).sort((a, b) => b.year - a.year) ?? [];
  return <div className="stack">
    <form className="stack" onSubmit={async event => {
      event.preventDefault();
      if (!mosque || !clock || pending || !Number.isInteger(year) || year < 1900 || year > 2200) return;
      setPending(true);
      const saved = await update(id, current => {
        const previous = current.occasional.find(item => item.type === type && item.year === year);
        const times = [...new Set([...(previous?.times ?? []), clock])].sort();
        return { ...current, occasional: [...current.occasional.filter(item => item !== previous), { type, year, times }] };
      });
      if (saved) setTime("");
      setPending(false);
    }}>
      <label className="field">{t("mosqueChoose")}<select value={id} onChange={event => setId(event.target.value)}>
        {mosques.map(mosque => <option key={mosque.id} value={mosque.id}>{mosque.name}</option>)}
      </select></label>
      <div className="equal-row">
        <label className="field">{t("mosqueOccasion")}<select value={type} onChange={event => setType(event.target.value as MosqueOccasion["type"])}>
          {mosqueOccasions.map(item => <option key={item} value={item}>{t(mosqueOccasionLabel[item])}</option>)}
        </select></label>
        <label className="field">{t("mosqueYear")}<input type="text" inputMode="numeric" dir="ltr" value={yearText} maxLength={4} required
          onChange={event => {
            const value = event.currentTarget.value;
            const valueYear = Number(mosqueInputDigits(value, locale));
            event.currentTarget.setCustomValidity(Number.isInteger(valueYear) && valueYear >= 1900 && valueYear <= 2200
              ? "" : t("mosqueYearRange", { from: 1900, to: 2200 }));
            setYearText(value);
          }} /></label>
      </div>
      <div className="equal-row">
        <label className="field">{t("mosqueTimeInput")}<MosqueTimeField name="occasionTime" value={time} change={setTime} required /></label>
        <button className="action self-end" disabled={!mosque || !time || pending}>{t("mosqueAddTime")}</button>
      </div>
    </form>
    {records.length > 0 && <section className="compact-stack">
      <h3>{t("mosqueOccasionTimes")}</h3>
      {records.map(({ year, times }) => <div className="card mosque-occasion-edit-row" key={year}>
        <strong>{number.format(year)}</strong>
        <ul>{times.map(item => <li className="row-between" key={item}>
          <time dateTime={item}>{mosqueClock(item, locale)}</time>
          <button className="text-button" disabled={pending} onClick={async () => {
            setPending(true);
            await update(id, current => ({
              ...current, occasional: current.occasional.map(entry => entry.type === type && entry.year === year
                ? { ...entry, times: entry.times.filter(value => value !== item) } : entry).filter(entry => entry.times.length > 0),
            }));
            setPending(false);
          }}>{t("mosqueRemove")}<span className="sr-only"> {mosqueClock(item, locale)}</span></button>
        </li>)}</ul>
      </div>)}
    </section>}
  </div>;
}
