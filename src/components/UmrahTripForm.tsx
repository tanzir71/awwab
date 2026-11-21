import { useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useCopy } from "@/lib/copy";
import { formatInputNumber, readLocalizedNumber } from "@/lib/localeNumbers";
import { readUmrahTripFile, updateRecord } from "@/lib/storageService";
import { emptyPreparation, initialTrip, tripDates, type UmrahTrip } from "@/lib/umrah";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

const tripNumberFields = {
  makkahNights: { label: "umrahPrepMakkahNights", max: 90, required: false },
  madinahNights: { label: "umrahPrepMadinahNights", max: 90, required: false },
  walk: { label: "umrahTripWalk", max: 120, required: true },
  crowd: { label: "umrahTripCrowd", max: 90, required: true },
  iqamah: { label: "umrahTripIqamah", max: 90, required: true },
} as const;
type TripNumberField = keyof typeof tripNumberFields;
const tripNumberNames = Object.keys(tripNumberFields) as TripNumberField[];

export function UmrahTripForm({ trip, gates, onSaved }: { trip: UmrahTrip; gates: string[]; onSaved?: () => void }) {
  const { t, locale, language } = useCopy();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const preparation = trip.preparation ?? emptyPreparation;
  const nativeNumber = language === "en";

  function numberField(name: TripNumberField, value?: number) {
    const { label, max, required } = tripNumberFields[name];
    return <label className="field">{t(label)}<input type={nativeNumber ? "number" : "text"} name={name} dir="ltr" inputMode="numeric"
      min={nativeNumber ? 0 : undefined} max={nativeNumber ? max : undefined} required={required}
      defaultValue={value === undefined ? undefined : formatInputNumber(value, locale)}
      onInput={event => event.currentTarget.setCustomValidity("")} /></label>;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    const start = text("start");
    const end = text("end");
    setError("");
    if (end < start) { setError(t("umrahTripDateError")); return; }
    const numbers = { walk: trip.walk, crowd: trip.crowd, iqamah: trip.iqamah,
      makkahNights: emptyPreparation.makkahNights, madinahNights: emptyPreparation.madinahNights };
    for (const name of tripNumberNames) {
      const { max, required } = tripNumberFields[name];
      const input = event.currentTarget.elements.namedItem(name) as HTMLInputElement;
      const raw = text(name);
      if (!raw && !required) continue;
      const value = nativeNumber ? input.valueAsNumber : readLocalizedNumber(raw, locale, "any");
      if (value === undefined || !Number.isInteger(value) || value < 0 || value > max) {
        input.setCustomValidity(value !== undefined && value > max ? t("zakatAmountMax", { max }) : t("qadaEnterWhole"));
        input.reportValidity();
        return;
      }
      numbers[name] = value;
    }
    setSaving(true);
    try {
      await updateRecord("umrah", initialTrip, old => ({
        ...old, start, end, group: text("group"), gate: text("gate"),
        hotel: { ...old.hotel, name: text("hotel"), room: text("room") },
        walk: numbers.walk, crowd: numbers.crowd, iqamah: numbers.iqamah,
        preparation: { ...preparation, completed: old.preparation?.completed ?? [], hotelArabic: text("hotelArabic"), hotelAddress: text("hotelAddress"),
          leader: text("leader"), phone: text("phone"), makkahNights: numbers.makkahNights, madinahNights: numbers.madinahNights },
      }));
      toast(t("umrahTripSaved"));
      onSaved?.();
    } catch {
      setError(t("umrahTripSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return <form className="card stack umrah-trip-form" onSubmit={event => void save(event)}>
    <div className="equal-row">
      <label className="field">{t("umrahTripStart")}<input name="start" type="date" required defaultValue={trip.start} /></label>
      <label className="field">{t("umrahTripEnd")}<input name="end" type="date" required defaultValue={trip.end} /></label>
    </div>
    <div className="equal-row">
      {numberField("makkahNights", preparation.makkahNights)}
      {numberField("madinahNights", preparation.madinahNights)}
    </div>
    <label className="field">{t("umrahTripHotelName")}<input name="hotel" defaultValue={trip.hotel.name} maxLength={120} /></label>
    <label className="field">{t("umrahTripHotelArabic")}<input name="hotelArabic" lang="ar" dir="rtl" defaultValue={preparation.hotelArabic} maxLength={120} /></label>
    <label className="field">{t("umrahTripHotelAddress")}<input name="hotelAddress" lang="ar" dir="rtl" defaultValue={preparation.hotelAddress} maxLength={240} /></label>
    <label className="field">{t("umrahTripRoom")}<input name="room" defaultValue={trip.hotel.room} maxLength={25} /></label>
    <label className="field">{t("umrahTripGroup")}<input name="group" defaultValue={trip.group} maxLength={120} /></label>
    <div className="equal-row">
      <label className="field">{t("umrahPrepLeader")}<input name="leader" defaultValue={preparation.leader} maxLength={120} /></label>
      <label className="field">{t("umrahTripPhone")}<input name="phone" type="tel" dir="ltr" defaultValue={preparation.phone} maxLength={30} /></label>
    </div>
    <label className="field">{t("umrahTripGate")}<input name="gate" defaultValue={trip.gate} list="haram-gates" maxLength={120} /></label>
    <datalist id="haram-gates">{gates.map(gate => <option key={gate} value={gate} />)}</datalist>
    <div className="form-grid">
      {numberField("walk", trip.walk)}
      {numberField("crowd", trip.crowd)}
      {numberField("iqamah", trip.iqamah)}
    </div>
    {error && <p role="alert">{error}</p>}
    <button className="action" disabled={saving}><CalendarDays size={18} />{t("umrahTripSave")}</button>
  </form>;
}

export function UmrahTripImport({ onImported }: { onImported?: () => void }) {
  const { t, locale } = useCopy();
  const [pending, setPending] = useState<ReturnType<typeof readUmrahTripFile>>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function choose(file: File) {
    setError("");
    try {
      if (file.size > 2_000_000) throw new Error("File is too large");
      setPending(readUmrahTripFile(await file.text()));
    } catch {
      setError(t("umrahPrepFileError"));
    }
  }

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      await updateRecord("umrah", initialTrip, old => ({ ...old, ...pending }));
      setPending(undefined);
      toast(t("umrahPrepImportSuccess"));
      onImported?.();
    } catch {
      setError(t("umrahTripSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return <div className="card compact-stack">
    <label className="field">{t("umrahPrepImport")}<input type="file" accept=".json,application/json" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) void choose(file);
    }} /></label>
    {error && <p role="alert">{error}</p>}
    <Dialog open={Boolean(pending)} onOpenChange={open => { if (!open && !saving) setPending(undefined); }}>
      {pending && <DialogContent className="awwab-dialog" showCloseButton={false}>
        <DialogTitle>{t("umrahPrepImportDetails")}</DialogTitle>
        <DialogDescription>{[tripDates(pending, locale), pending.hotel.name].filter(Boolean).join(" · ") || t("umrahPrepTrip")}</DialogDescription>
        <p className="small muted">{t("umrahTripImportHint")}</p>
        {error && <p role="alert">{error}</p>}
        <div className="equal-row">
          <DialogClose asChild><button className="action light" type="button" disabled={saving}>{t("shareClose")}</button></DialogClose>
          <button className="action" type="button" disabled={saving} onClick={() => void confirm()}>{t("umrahPrepImport")}</button>
        </div>
      </DialogContent>}
    </Dialog>
  </div>;
}
