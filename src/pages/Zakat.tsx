import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SectionNav } from "@/components/Surface";
import { useRecord } from "@/hooks/use-awwab";
import { dateKey } from "@/lib/dates";
import { hijriMonths } from "@/lib/hijri";
import { updateRecord, type Settings } from "@/lib/storageService";
import { calculateZakat, initialZakat, nisabWeight, zakatMoney } from "@/lib/zakat";

export function Zakat({ settings }: { settings: Settings }) {
  const saved = useRecord("zakat", initialZakat);
  const [draft, setDraft] = useState<Partial<typeof initialZakat>>({});
  const [payment, setPayment] = useState("");
  const profile = { ...saved, ...draft };
  const result = calculateZakat([profile.cash, profile.metals, profile.trade], [profile.debt], profile.basis, profile.price, profile.unit);
  const change = (patch: Partial<typeof initialZakat>) => setDraft(old => ({ ...old, ...patch }));
  const save = async (patch: Partial<typeof initialZakat>) => {
    try {
      await updateRecord("zakat", initialZakat, old => ({ ...old, ...patch }));
      setDraft({});
      toast("Zakat profile saved on this device.");
    } catch { toast.error("The zakat profile could not be saved."); }
  };
  const amounts = [{ key: "cash", title: "Cash and savings" }, { key: "metals", title: "Gold and silver value" }, { key: "trade", title: "Trade goods and other zakatable assets" }, { key: "debt", title: "Debts due" }] as const;
  return <div className="stack">
    <SectionNav title="Zakat" back="/plan" />
    <section className="card night stack">
      <p className="caption">Estimated zakat · 2.5%</p>
      <h2 className="numeral">{result.due === undefined ? "—" : zakatMoney(result.due, profile.currency)}</h2>
      <p className="muted">Net assets · {zakatMoney(result.net, profile.currency)}</p>
      <p className="muted">{result.nisab === undefined ? "Enter a current metal price to calculate the nisab." : `Nisab · ${zakatMoney(result.nisab, profile.currency)}`}</p>
    </section>
    <form className="stack" onSubmit={event => { event.preventDefault(); void save(draft); }}>
      <section className="card stack">
        <h2>Nisab</h2>
        <div className="equal-row">
          {(["silver", "gold"] as const).map(basis => <button key={basis} type="button" aria-pressed={profile.basis === basis} className={`action ${profile.basis === basis ? "" : "light"}`} onClick={() => change({ basis, price: 0 })}>{basis === "silver" ? "Silver" : "Gold"}</button>)}
        </div>
        <p className="muted">{nisabWeight(profile.basis, "g")} g · about {nisabWeight(profile.basis, "bhori").toFixed(2)} bhori</p>
        <div className="equal-row">
          <label className="field">Price per unit<input type="number" min="0" step=".01" value={profile.price || ""} onChange={event => change({ price: Number(event.target.value) })} /></label>
          <label className="field">Unit<select value={profile.unit} onChange={event => change({ unit: event.target.value as typeof profile.unit, price: 0 })}><option value="g">Gram</option><option value="bhori">Bhori / tola</option></select></label>
        </div>
      </section>
      <section className="card stack">
        <h2>What you own and owe</h2>
        <label className="field">Currency<select value={profile.currency} onChange={event => change({ currency: event.target.value })}>{["BDT", "SAR", "USD", "GBP", "EUR", "INR", "PKR", "AED", "CAD", "AUD"].map(item => <option key={item}>{item}</option>)}</select></label>
        {amounts.map(item => <label className="field" key={item.key}>{item.title}<input type="number" min="0" step=".01" value={profile[item.key] || ""} onChange={event => change({ [item.key]: Number(event.target.value) })} /></label>)}
      </section>
      <section className="card stack">
        <h2>Hawl · Hijri anniversary</h2>
        <div className="equal-row">
          <label className="field">Month<select value={profile.hawlMonth} onChange={event => change({ hawlMonth: Number(event.target.value) })}>{hijriMonths.map((month, i) => <option value={i + 1} key={month}>{month}</option>)}</select></label>
          <label className="field">Day<input type="number" min="1" max="30" required value={profile.hawlDay || ""} onChange={event => change({ hawlDay: Number(event.target.value) })} /></label>
        </div>
      </section>
      <button className="action">Save zakat profile</button>
    </form>
    <section className="card stack">
      <h2>Payments</h2>
      {saved.payments.map((item, i) => <p key={i} className="list-row">{item.day} · {zakatMoney(item.amount, item.currency)}</p>)}
      <form className="equal-row" onSubmit={event => {
        event.preventDefault();
        const amount = Number(payment);
        if (!(amount > 0)) return;
        void updateRecord("zakat", initialZakat, old => ({ ...old, payments: [...old.payments, { amount, day: dateKey(new Date(), settings.city.timeZone), currency: profile.currency }] })).then(() => setPayment(""), () => toast.error("The payment could not be saved."));
      }}>
        <label className="field">Amount paid<input type="number" min=".01" step=".01" value={payment} onChange={event => setPayment(event.target.value)} required /></label>
        <button className="action soft self-end">Log payment</button>
      </form>
    </section>
    <section className="card tint compact-stack">
      <strong>This is a calculator, not a fatwa.</strong><p>Scholars differ on worn jewellery and the choice of gold or silver nisab.</p>
      <Link to="/print/zakat-summary" className="text-button">Print your zakat summary</Link>
    </section>
  </div>;
}
