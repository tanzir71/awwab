import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCopy } from "@/lib/copy";
import { planMonth } from "@/lib/plan-copy";
import { updateRecord } from "@/lib/storageService";
import { initialZakat, balanceLabels, metalKinds, metalLabels, unitGrams, zakatBalances, zakatPrices, type MetalUnit, type NisabBasis,
  type ZakatAsset, type ZakatBalance, type ZakatProfile } from "@/lib/zakat";

const currencies = ["BDT", "SAR", "USD", "GBP", "EUR", "INR", "PKR", "AED", "CAD", "AUD"];

export type ZakatEditor =
  | { type: "settings" }
  | { type: "balance"; field: ZakatBalance; label: string }
  | { type: "asset"; asset?: ZakatAsset; kind?: ZakatAsset["kind"]; basis?: NisabBasis }
  | { type: "payment" };

type ChangeProfile = (current: ZakatProfile) => ZakatProfile;
type SubmitChange = (event: FormEvent<HTMLFormElement>, change: (fields: FormData) => ChangeProfile) => void;
const fieldText = (fields: FormData, key: string) => String(fields.get(key) ?? "").trim();
const fieldNumber = (fields: FormData, key: string) => Number(fieldText(fields, key));
const rateInput = (rate: number | undefined, unit: MetalUnit) =>
  rate === undefined ? "" : String(Number((rate * unitGrams(unit)).toPrecision(12)));

function UnitField({ label, unit, onChange }: { label: string; unit: MetalUnit; onChange: (unit: MetalUnit) => void }) {
  const { t } = useCopy();
  return <label className="field">{label}<select value={unit} onChange={e => onChange(e.target.value as MetalUnit)}>
    <option value="g">{t("zakatGramUnit")}</option><option value="bhori">{t("zakatBhoriUnit")}</option>
  </select></label>;
}

function SettingsFields({ profile, submit, actions }: { profile: ZakatProfile; submit: SubmitChange; actions: ReactNode }) {
  const { t, language } = useCopy();
  const [currency, setCurrency] = useState(profile.currency);
  const [unit, setUnit] = useState(profile.unit);
  const [hawlSet, setHawlSet] = useState(profile.hawlSet !== false);
  const [inputs, setInputs] = useState(() => {
    const prices = zakatPrices(profile);
    return { gold: rateInput(prices.gold, unit), silver: rateInput(prices.silver, unit) };
  });
  const change = (fields: FormData): ChangeProfile => {
    const prices: ZakatProfile["prices"] = {};
    for (const metal of metalKinds) if (inputs[metal]) prices[metal] = Number(inputs[metal]) / unitGrams(unit);
    return old => ({
      ...old, currency, unit, prices, price: (prices[old.basis] ?? 0) * unitGrams(unit),
      hawlSet, hawlMonth: hawlSet ? fieldNumber(fields, "month") : old.hawlMonth,
      hawlDay: hawlSet ? fieldNumber(fields, "day") : old.hawlDay,
    });
  };
  const changeUnit = (next: MetalUnit) => {
    const convert = (value: string) => value && rateInput(Number(value) / unitGrams(unit), next);
    setInputs({ gold: convert(inputs.gold), silver: convert(inputs.silver) });
    setUnit(next);
  };

  return <form className="stack" onSubmit={event => submit(event, change)}>
    <div className="equal-row">
      <label className="field">{t("zakatCurrency")}<select value={currency} onChange={e => {
        const next = e.target.value;
        const prices = next === profile.currency ? zakatPrices(profile) : {};
        setCurrency(next);
        setInputs({ gold: rateInput(prices.gold, unit), silver: rateInput(prices.silver, unit) });
      }}>{[...new Set([profile.currency, ...currencies])].map(code => <option key={code}>{code}</option>)}</select></label>
      <UnitField label={t("zakatUnit")} unit={unit} onChange={changeUnit} />
    </div>
    <div className="equal-row">{metalKinds.map(metal => <label className="field" key={metal}>
      {t("zakatPurePrice", { metal: t(metalLabels[metal]).toLocaleLowerCase(language), unit: t(unit === "g" ? "zakatGramUnit" : "zakatBhoriUnit").toLocaleLowerCase(language) })}
      <input type="number" inputMode="decimal" step="any" min="0" value={inputs[metal]}
        onChange={e => setInputs(old => ({ ...old, [metal]: e.target.value }))} />
    </label>)}</div>
    <p className="small muted">{t("zakatPriceNote")}</p>
    <label className="zakat-checkbox"><input type="checkbox" checked={hawlSet} onChange={e => setHawlSet(e.target.checked)} />{t("zakatHawl")}</label>
    {hawlSet && <div className="equal-row">
      <label className="field">{t("zakatHawlMonth")}<select name="month" defaultValue={profile.hawlMonth}>
        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{planMonth(i + 1, language)}</option>)}
      </select></label>
      <label className="field">{t("zakatHawlDay")}<input name="day" type="number" inputMode="numeric" min="1" max="30" required defaultValue={profile.hawlDay} /></label>
    </div>}
    {actions}
  </form>;
}

function AssetFields({ editor, profile, submit, actions }: {
  editor: Extract<ZakatEditor, { type: "asset" }>; profile: ZakatProfile; submit: SubmitChange; actions: ReactNode;
}) {
  const { t } = useCopy();
  const { asset } = editor;
  const [kind, setKind] = useState(asset?.kind ?? editor.kind ?? "cash");
  const metal = asset?.kind === "metal" ? asset : undefined;
  const [basis, setBasis] = useState(metal?.basis ?? editor.basis ?? "gold");
  const [unit, setUnit] = useState(metal?.unit ?? profile.unit);
  const change = (fields: FormData): ChangeProfile => {
    const base = { id: asset?.id ?? crypto.randomUUID(), name: fieldText(fields, "name") };
    const item: ZakatAsset = kind === "metal"
      ? { ...base, kind, basis, unit, weight: fieldNumber(fields, "weight"),
        purity: fieldNumber(fields, "purity") * (basis === "gold" ? 100 / 24 : 1) }
      : { ...base, kind, amount: fieldNumber(fields, "amount") };
    return old => ({ ...old, assets: asset
      ? (old.assets ?? []).map(other => other.id === asset.id ? item : other)
      : [...(old.assets ?? []), item] });
  };

  return <form className="stack" onSubmit={event => submit(event, change)}>
    <label className="field">{t("zakatAssetKind")}<select value={kind} onChange={e => setKind(e.target.value as ZakatAsset["kind"])}>
      {zakatBalances.filter(item => item !== "metals" || asset?.kind === "metals").map(item => <option value={item} key={item}>{t(balanceLabels[item])}</option>)}
      <option value="metal">{t("zakatMetalHolding")}</option>
    </select></label>
    <label className="field">{t("zakatAssetName")}<input name="name" maxLength={100} defaultValue={asset?.name} /></label>
    {kind === "metal" ? <>
      <div className="equal-row">
        <label className="field">{t("zakatMetal")}<select value={basis} onChange={e => setBasis(e.target.value as NisabBasis)}>
          {metalKinds.map(item => <option value={item} key={item}>{t(metalLabels[item])}</option>)}
        </select></label>
        <UnitField label={t("zakatWeightUnit")} unit={unit} onChange={setUnit} />
      </div>
      <div className="equal-row">
        <label className="field">{t("zakatWeight")}<input name="weight" type="number" inputMode="decimal" min=".001" step="any" required defaultValue={metal?.weight} /></label>
        <label className="field">{t(basis === "gold" ? "zakatPurityGold" : "zakatPuritySilver")}
          <input key={basis} name="purity" type="number" inputMode="decimal" min=".01" max={basis === "gold" ? 24 : 100} step="any" required
            defaultValue={metal?.basis === basis ? Number((metal.purity * (basis === "gold" ? 24 / 100 : 1)).toFixed(6)) : basis === "gold" ? 24 : 100} />
        </label>
      </div>
    </> : <MoneyField label={t("zakatAmount")} currency={profile.currency} value={asset && asset.kind !== "metal" ? asset.amount : undefined} />}
    {actions}
  </form>;
}

function MoneyField({ label, currency, value, positive = false }: { label: string; currency: string; value?: number; positive?: boolean }) {
  return <label className="field">{label} · {currency}
    <input name="amount" type="number" inputMode="decimal" min={positive ? ".01" : "0"} step="any" required defaultValue={value} />
  </label>;
}

export function ZakatDialog({ editor, profile, day, close, restoreFocus, paymentYear }: {
  editor?: ZakatEditor; profile: ZakatProfile; day: string; close: () => void; restoreFocus: () => void;
  paymentYear: (date: string, current: ZakatProfile) => number | undefined;
}) {
  const { t } = useCopy();
  const [saving, setSaving] = useState(false);
  async function save(change: ChangeProfile) {
    if (saving) return;
    setSaving(true);
    try {
      await updateRecord("zakat", initialZakat, change);
      close();
    } catch {
      toast.error(t("zakatSaveError"));
    } finally {
      setSaving(false);
    }
  }
  const submit: SubmitChange = (event, change) => {
    event.preventDefault();
    void save(change(new FormData(event.currentTarget)));
  };
  const title = editor?.type === "settings" ? t("zakatSettings") : editor?.type === "balance" ? t("zakatEditBalance", { name: editor.label }) :
    editor?.type === "asset" ? t(editor.asset ? "zakatEditAsset" : "zakatAdd") : t("zakatLog");
  const editedAsset = editor?.type === "asset" ? editor.asset : undefined;
  const submitButton = <button className="action" disabled={saving} type="submit">{editor?.type === "payment" ? t("zakatLog") : t("zakatSave")}</button>;
  const actions = editedAsset ? <div className="equal-row">
    <button className="action light" disabled={saving} type="button" onClick={() => void save(old => ({
      ...old, assets: (old.assets ?? []).filter(item => item.id !== editedAsset.id),
    }))}>{t("zakatRemove")}</button>{submitButton}
  </div> : submitButton;

  return <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open && !saving) close(); }}>
    <DialogContent className="zakat-dialog" overlayClassName="zakat-overlay" showCloseButton={false} aria-describedby={undefined}
      onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
      <div className="row-between">
        <DialogTitle className="zakat-dialog-title">{title}</DialogTitle>
        <DialogClose asChild><button type="button" disabled={saving} className="icon-button" aria-label={t("planClose")}><X size={19} aria-hidden="true" /></button></DialogClose>
      </div>
      {editor?.type === "settings" && <SettingsFields profile={profile} submit={submit} actions={actions} />}
      {editor?.type === "asset" && <AssetFields editor={editor} profile={profile} submit={submit} actions={actions} />}
      {editor?.type === "balance" && <form className="stack" onSubmit={event => submit(event, fields => old => ({
        ...old, [editor.field]: fieldNumber(fields, "amount"),
      }))}><MoneyField label={t("zakatAmount")} currency={profile.currency} value={profile[editor.field] ?? 0} />{actions}</form>}
      {editor?.type === "payment" && <form className="stack" onSubmit={event => submit(event, fields => old => {
        const date = fieldText(fields, "date");
        return { ...old, payments: [...old.payments, { day: date, currency: profile.currency, amount: fieldNumber(fields, "amount"),
          name: fieldText(fields, "name") || undefined, hawlYear: paymentYear(date, old) }] };
      })}>
        <MoneyField label={t("zakatPaidAmount")} currency={profile.currency} positive />
        <label className="field">{t("zakatPaidDate")}<input name="date" type="date" required max={day} defaultValue={day} /></label>
        <label className="field">{t("zakatRecipient")}<input name="name" maxLength={100} /></label>
        {actions}
      </form>}
    </DialogContent>
  </Dialog>;
}
