import { useState } from "react";
import { CalendarDays, ChevronRight, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { SectionNav } from "@/components/Surface";
import { useRecord } from "@/hooks/use-awwab";
import { addDays, dateKey } from "@/lib/dates";
import { mosqueDefaults, mosqueRoles, mosqueSources, weekdays, type Mosque, type MosquePlan } from "@/lib/mosques";
import { updateRecord, type Settings } from "@/lib/storageService";
import { distance, type Coord } from "@/lib/umrah";
import { calendarDefaults, hijriOn } from "@/lib/hijri";
import { prayerIds, prayerNames } from "@/types/Prayer";

const occasionNames = { eid_fitr: "Eid al-Fitr", eid_adha: "Eid al-Adha", tarawih: "Tarawih" };

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function startMosque(): Mosque {
  return { id: crypto.randomUUID(), name: "", role: "home", jamaat: {}, occasional: [], source: "visited", updatedAt: new Date().toISOString() };
}

export function Mosques({ settings, now }: { settings: Settings; now: Date }) {
  const plan = useRecord("mosques", mosqueDefaults);
  const [editor, edit] = useState<Mosque>();
  const [position, setPosition] = useState<Coord>();
  const [locating, setLocating] = useState(false);
  const config = useRecord("calendar", calendarDefaults);
  const day = dateKey(now, settings.city.timeZone);
  const hijri = hijriOn(day, settings.hijriAdjust, config.anchors);
  const seasonal = hijri.month === 9 || (hijri.month === 8 && hijri.day >= 24);
  const [weekday, setWeekday] = useState(() => new Date(`${dateKey(now, settings.city.timeZone)}T12:00:00Z`).getUTCDay());
  async function save(update: (old: MosquePlan) => MosquePlan) {
    try { await updateRecord("mosques", mosqueDefaults, update); return true; }
    catch { toast.error("The mosque details could not be saved."); return false; }
  }
  if (editor) return <MosqueForm mosque={editor} cancel={() => edit(undefined)} save={async mosque => {
    if (await save(old => ({ ...old, mosques: old.mosques.some(item => item.id === mosque.id)
      ? old.mosques.map(item => item.id === mosque.id ? mosque : item) : [...old.mosques, mosque] }))) edit(undefined);
  }} />;
  const nearby = position && plan.mosques.filter(item => item.location).map(mosque => ({
    mosque, meters: distance(position, mosque.location),
  })).sort((a, b) => a.meters - b.meters)[0];
  return <div className="stack">
    <SectionNav title="My mosques" back="/plan" />
    {plan.mosques.map(mosque => {
      const stale = mosque.updatedAt.slice(0, 10) < addDays(day, seasonal ? -30 : -120);
      return <section className="card stack" key={mosque.id}>
        <button className="row-between text-left" onClick={() => edit(mosque)}>
          <span className="icon-box"><MapPin size={20} /></span><span className="grow"><strong>{mosque.name}</strong><small className="block muted">{mosque.role} · {mosque.source}</small></span><ChevronRight size={18} />
        </button>
        {stale && <span className="chip soft">Time to check the timetable</span>}
        <div className="chips">{prayerIds.filter(id => mosque.jamaat[id]).map(id => <span className="chip" key={id}>{prayerNames[id]} {mosque.jamaat[id] === "adhan+5" ? "adhan + 5 min" : mosque.jamaat[id]}</span>)}</div>
        {mosque.jumuah?.prayer && <p>Jumuʿah · {mosque.jumuah.khutbah && `Khutbah ${mosque.jumuah.khutbah} · `}Jamaat {mosque.jumuah.prayer}</p>}
        {mosque.occasional.length > 0 && <div className="compact-stack">{mosque.occasional.map(item => <p key={`${item.type}-${item.year}`}>{occasionNames[item.type]} {item.year} · {item.times.join(", ")}</p>)}</div>}
        {mosque.photo && <details><summary>Timetable photo</summary><img alt={`Timetable for ${mosque.name}`} src={mosque.photo} loading="lazy" /></details>}
        <a className="text-button" href={`https://wa.me/${mosque.contact ?? ""}?text=${encodeURIComponent(`Assalamu alaikum. Could you share the current jamaat timetable for ${mosque.name}? Thank you.`)}`}>Ask on WhatsApp</a>
      </section>;
    })}
    {!plan.mosques.length && <p className="card soft">Add your first mosque to see its jamaat time on Today.</p>}
    <button className="action" onClick={() => edit(startMosque())}><Plus size={20} /> Add mosque</button>
    {plan.mosques.some(mosque => mosque.location) && <section className="card compact-stack">
      <h2>Nearest saved mosque</h2>
      {nearby && <p>{nearby.mosque.name} · {nearby.meters < 1000 ? `${Math.round(nearby.meters)} m` : `${(nearby.meters / 1000).toFixed(1)} km`} away</p>}
      <p className="muted small">Your location is used once on this device to compare the saved coordinates.</p>
      <button className="action soft" disabled={locating} type="button" onClick={() => {
        if (!navigator.geolocation) { toast.error("Location is unavailable in this browser."); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(result => {
          setPosition({ lat: result.coords.latitude, lon: result.coords.longitude });
          setLocating(false);
        }, () => {
          toast.error("Your location is unavailable. You can still view all saved mosques.");
          setLocating(false);
        }, { timeout: 12000 });
      }}>{locating ? "Finding your location…" : "Use my location"}</button>
    </section>}
    {plan.mosques.length > 0 && <section className="card stack">
      <h2 className="with-icon"><CalendarDays size={20} /> Weekly mapping</h2>
      <label className="field">Day<select value={weekday} onChange={event => setWeekday(Number(event.target.value))}>{weekdays.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>
      {prayerIds.map(id => {
        const key = `${weekday}-${id}`;
        return <label className="field" key={id}>{prayerNames[id]}
          <select aria-label={prayerNames[id]} value={plan.mapping[key] ?? ""} onChange={event => {
            const mosque = event.target.value;
            void save(old => ({ ...old, mapping: { ...old.mapping, [key]: mosque } }));
          }}>
            <option value="">No mosque mapped</option>
            {plan.mosques.map(mosque => <option key={mosque.id} value={mosque.id}>{mosque.name}</option>)}
          </select>
        </label>;
      })}
    </section>}
  </div>;
}

function MosqueForm({ mosque, cancel, save }: { mosque: Mosque; cancel: () => void; save: (value: Mosque) => Promise<void> }) {
  const [relativeMaghrib, setRelativeMaghrib] = useState(mosque.jamaat.maghrib === "adhan+5");
  const [pending, setPending] = useState(false);
  const [occasion, setOccasion] = useState<keyof typeof occasionNames>("eid_fitr");
  const [year, setYear] = useState(new Date().getFullYear());
  const [times, setTimes] = useState("");
  const [entries, setEntries] = useState(mosque.occasional);
  return <div className="stack">
    <h1>{mosque.name ? "Edit mosque" : "Add mosque"}</h1>
    <form className="card stack" onSubmit={async event => {
      event.preventDefault();
      if (pending) return;
      const values = new FormData(event.currentTarget);
      const photo = values.get("photo");
      setPending(true);
      try {
        const jamaat = Object.fromEntries(prayerIds.map(id => [id, String(values.get(id) ?? "")]).filter(([, value]) => value));
        if (relativeMaghrib) jamaat.maghrib = "adhan+5";
        const name = String(values.get("name")).trim();
        if (!name) throw new Error("Empty mosque name");
        const lat = String(values.get("lat") ?? "").trim();
        const lon = String(values.get("lon") ?? "").trim();
        if (Boolean(lat) !== Boolean(lon)) { toast.error("Enter both latitude and longitude, or leave both blank."); return; }
        const picture = photo instanceof File && photo.size ? photo : undefined;
        if (picture && (!["image/jpeg", "image/png", "image/webp"].includes(picture.type) || picture.size > 2_000_000)) {
          toast.error("Choose a JPEG, PNG or WebP photo under 2 MB.");
          return;
        }
        await save({ ...mosque, name, jamaat, role: values.get("role") as Mosque["role"], source: values.get("source") as Mosque["source"],
          updatedAt: new Date().toISOString(), photo: picture ? await readPhoto(picture) : mosque.photo,
          contact: String(values.get("contact")).replace(/\D/g, ""), occasional: entries,
          location: lat && lon ? { lat: Number(lat), lon: Number(lon) } : undefined,
          jumuah: { khutbah: String(values.get("khutbah")), prayer: String(values.get("jumuah")) } });
      } catch { toast.error("The mosque details could not be saved."); }
      finally { setPending(false); }
    }}>
      <label className="field">Mosque name<input name="name" required defaultValue={mosque.name} maxLength={100} /></label>
      <div className="equal-row">
        <label className="field">Role<select name="role" defaultValue={mosque.role}>{mosqueRoles.map(role => <option key={role}>{role}</option>)}</select></label>
        <label className="field">Source<select name="source" defaultValue={mosque.source}>{mosqueSources.map(source => <option key={source}>{source}</option>)}</select></label>
      </div>
      <h2>Jamaat timetable</h2>
      <div className="form-grid">{prayerIds.map(id => <label className="field" key={id}>{prayerNames[id]}
        <input type="time" name={id} defaultValue={mosque.jamaat[id] === "adhan+5" ? undefined : mosque.jamaat[id]} disabled={id === "maghrib" && relativeMaghrib} />
      </label>)}</div>
      <label className="with-icon"><input type="checkbox" checked={relativeMaghrib} onChange={event => setRelativeMaghrib(event.target.checked)} /> Maghrib is 5 minutes after adhan</label>
      <div className="equal-row">
        <label className="field">Jumuʿah khutbah<input type="time" name="khutbah" defaultValue={mosque.jumuah?.khutbah} /></label>
        <label className="field">Jumuʿah jamaat<input type="time" name="jumuah" defaultValue={mosque.jumuah?.prayer} /></label>
      </div>
      <h2>Eid and Tarawih</h2>
      {entries.map(item => <div className="row-between" key={`${item.type}-${item.year}`}><span>{occasionNames[item.type]} {item.year} · {item.times.join(", ")}</span><button type="button" className="text-button" onClick={() => setEntries(entries.filter(entry => entry !== item))}>Remove</button></div>)}
      <div className="equal-row">
        <label className="field">Occasion<select value={occasion} onChange={event => setOccasion(event.target.value as typeof occasion)}>{Object.entries(occasionNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="field">Gregorian year<input type="number" min="1900" max="2200" value={year || ""} onChange={event => setYear(Number(event.target.value))} /></label>
      </div>
      <div className="equal-row">
        <label className="field">Jamaat time<input type="time" value={times} onChange={event => setTimes(event.target.value)} /></label>
        <button className="action soft self-end" type="button" disabled={!times || year < 1900 || year > 2200} onClick={() => {
          const matching = entries.find(item => item.year === year && item.type === occasion);
          setEntries([...entries.filter(item => item !== matching), { type: occasion, year, times: [...new Set([...(matching?.times ?? []), times])].sort() }]);
          setTimes("");
        }}>Add time</button>
      </div>
      <label className="field">Timetable photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" /></label>
      <label className="field">WhatsApp number with country code (optional)<input type="tel" name="contact" defaultValue={mosque.contact} /></label>
      <div className="equal-row">
        <label className="field">Latitude (optional)<input name="lat" type="number" step="any" min="-90" max="90" defaultValue={mosque.location?.lat} /></label>
        <label className="field">Longitude (optional)<input name="lon" type="number" step="any" min="-180" max="180" defaultValue={mosque.location?.lon} /></label>
      </div>
      <div className="equal-row"><button className="action light" type="button" onClick={cancel}>Cancel</button><button className="action" disabled={pending}>Save mosque</button></div>
    </form>
  </div>;
}
