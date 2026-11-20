import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { SectionNav } from "@/components/Surface";
import { ZakatDialog, type ZakatEditor } from "@/components/ZakatEditors";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { saveCalendar } from "@/lib/calendarFile";
import { useCopy } from "@/lib/copy";
import { dateKey, formatDay } from "@/lib/dates";
import { downloadFile } from "@/lib/download";
import { calendarDefaults, hijriOn } from "@/lib/hijri";
import { planMonth } from "@/lib/plan-copy";
import { updateRecord, type Settings } from "@/lib/storageService";
import { initialZakat, metalKinds, metalLabels, balanceLabels, nisabWeight, paymentsForHawl,
  unitGrams, zakatHawl, zakatMoney, zakatPrices, zakatProfileTotals, zakatSources,
  type NisabBasis, type ZakatAsset, type ZakatBalance, type ZakatProfile } from "@/lib/zakat";

type Payment = ZakatProfile["payments"][number];
type FormatMoney = (value?: number) => string;

function exportPayments(payments: Payment[]) {
  const cell = (value: string) => {
    const text = [...value].map(char => char.charCodeAt(0) < 32 ? " " : char).join("");
    return '"' + (/^\s*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
  };
  const lines = payments.map(item => [item.day, item.amount, item.currency, item.hawlYear ?? "", cell(item.name ?? "")].join(","));
  downloadFile(new Blob(["\uFEFF", ["date,amount,currency,hijri_year,note", ...lines].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  }), "awwab-zakat-payments.csv");
}

function NisabSwitch({ basis, desktop, select }: { basis: NisabBasis; desktop: boolean; select: (basis: NisabBasis) => void }) {
  const { t } = useCopy();
  return <div className="zakat-nisab-switch equal-row" role="group" aria-label={t("zakatNisab")}>
    {(["silver", "gold"] as const).map(metal => <button key={metal} type="button" aria-pressed={basis === metal} onClick={() => select(metal)}>
      <strong>{desktop ? t("zakatNisabLabel", { metal: t(metalLabels[metal]) }) : t(metalLabels[metal])} · {t("zakatGrams", { count: nisabWeight(metal, "g") })}</strong>
      {!desktop && <span>≈ {t("zakatBhori", { count: Number(nisabWeight(metal, "bhori").toFixed(metal === "gold" ? 1 : 0)) })}</span>}
    </button>)}
  </div>;
}

function PaymentList({ payments, formatDate }: { payments: Payment[]; formatDate: (date: string) => string }) {
  const { t, locale } = useCopy();
  if (payments.length === 0) return <p className="small muted">{t("zakatNoPayments")}</p>;
  return <ul className="zakat-payment-list">
    {payments.map((item, i) => <li key={i}>
      <span>{item.name && <strong><bdi>{item.name}</bdi></strong>}<small className="muted"><time dateTime={item.day}>{formatDate(item.day)}</time></small></span>
      <strong><bdi>{zakatMoney(item.amount, item.currency, locale, true)}</bdi></strong>
    </li>)}
  </ul>;
}

function Payments({ profile, hawl, due, money, formatDate, desktop }: {
  profile: ZakatProfile; hawl: ReturnType<typeof zakatHawl>; due?: number; money: FormatMoney;
  formatDate: (date: string) => string; desktop: boolean;
}) {
  const { t } = useCopy();
  const all = [...profile.payments].reverse().sort((a, b) => b.day.localeCompare(a.day));
  const active = paymentsForHawl({ ...profile, payments: all }, hawl);
  const history = hawl ? all.filter(item => !active.includes(item)) : [];
  const paid = active.filter(item => item.currency === profile.currency).reduce((sum, item) => sum + item.amount, 0);
  return <section className="card zakat-payments compact-stack">
    <div className="row-between">
      <h2>{t(hawl ? "zakatPeriodPayments" : "zakatPayments")}</h2>
      {all.length > 0 && <button type="button" className="text-button" onClick={() => exportPayments(all)}>{t("zakatExport")}</button>}
    </div>
    <PaymentList payments={active} formatDate={formatDate} />
    {hawl && due !== undefined && <div className="row-between zakat-remaining"><strong>{t("zakatRemaining")}</strong><bdi>{money(Math.max(0, due - paid))}</bdi></div>}
    {history.length > 0 && <details className="zakat-history"><summary>{t("zakatPaymentHistory")}</summary><PaymentList payments={history} formatDate={formatDate} /></details>}
    {!desktop && <Link className="text-button" to="/print/zakat-summary">{t("zakatPrint")}</Link>}
  </section>;
}

export function Zakat({ settings, now, desktop }: { settings: Settings; now: Date; desktop: boolean }) {
  const { t, language, locale } = useCopy();
  const profile = useRecord("zakat", initialZakat);
  const calendar = useRecord("calendar", calendarDefaults);
  const fullDesktop = useDesktop(1280);
  const [editor, setEditor] = useState<ZakatEditor>();
  const trigger = useRef<HTMLElement>();
  const day = dateKey(now, settings.city.timeZone);
  const hawlOn = (date: string, current: ZakatProfile) => zakatHawl(date, current, settings.hijriAdjust, calendar.anchors);
  const hawl = hawlOn(day, profile);
  const result = zakatProfileTotals(profile);
  const prices = zakatPrices(profile);
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const rate = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(.025);
  const money: FormatMoney = value => value === undefined ? "—" : zakatMoney(value, profile.currency, locale, desktop);
  const hijriDate = (value: { day: number; month: number; year: number }) =>
    number.format(value.day) + " " + planMonth(value.month, locale) + " " + number.format(value.year);
  const amount = (value: number | undefined, debt: boolean) => value === undefined ? "—" : (debt && value > 0 ? "− " : "") + money(value);
  const weight = (value: number, unit: "g" | "bhori") => t(unit === "g" ? "zakatGrams" : "zakatBhori", { count: Number(value.toFixed(3)) });
  const open = (value: ZakatEditor) => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    setEditor(value);
  };
  const openSettings = () => open({ type: "settings" });
  const remind = () => {
    if (!hawl) { openSettings(); return; }
    saveCalendar([{ id: "zakat-hawl-" + hawl.year, title: t("zakatHawlReminder"), start: hawl.date, alarm: 0 }], "awwab-zakat.ics");
  };
  const selectBasis = (basis: NisabBasis) => {
    void updateRecord("zakat", initialZakat, old => {
      const allPrices = zakatPrices(old);
      return { ...old, basis, prices: allPrices, price: (allPrices[basis] ?? 0) * unitGrams(old.unit) };
    }).catch(() => toast.error(t("zakatSaveError")));
  };
  const moneyRow = (label: string, value: number | undefined, edit: ZakatEditor, debt = false, detail?: string) => <button type="button"
    className="zakat-amount-row" onClick={() => open(edit)}>
    <span>{label}{detail && <small className="muted">{detail}</small>}</span><bdi>{amount(value, debt)}</bdi>
  </button>;
  const assetRow = (asset: ZakatAsset, value?: number) => {
    const name = asset.kind !== "metal" ? t(balanceLabels[asset.kind]) : [
      t(metalLabels[asset.basis]), weight(asset.weight, asset.unit) + ", " +
      t(asset.basis === "gold" ? "zakatKarat" : "zakatPurity", { count: Number((asset.basis === "gold" ? asset.purity * .24 : asset.purity).toFixed(2)) }),
    ].join(" · ");
    return moneyRow(asset.name || name, value, { type: "asset", asset }, asset.kind === "debt", asset.name ? name : undefined);
  };
  const balanceRows = (field: ZakatBalance, label = t(balanceLabels[field])) =>
    <div className="zakat-amount-group" key={field}>
      {moneyRow(label, profile[field] ?? 0, { type: "balance", field, label }, field === "debt")}
      {result.assets.filter(item => item.asset.kind === field).map(({ asset, value }) => <div key={asset.id}>{assetRow(asset, value)}</div>)}
    </div>;
  const weighed = result.assets.filter(item => item.asset.kind === "metal");
  const switcher = <NisabSwitch basis={profile.basis} desktop={desktop} select={selectBasis} />;
  const status = !result.complete ? t("zakatAssetsNeedPrices") : result.nisab === undefined
    ? t("zakatPriceNeeded", { metal: t(metalLabels[profile.basis]).toLocaleLowerCase(language) })
    : t(result.net >= result.nisab ? "zakatAbove" : "zakatBelow");
  const dateText = hawl ? t("zakatNextHawl", {
    hijri: hijriDate(hawl), gregorian: formatDay(hawl.date, { weekday: "short", day: "numeric", month: "short" }, locale), days: hawl.daysUntil,
  }) : t("zakatSetHawl");
  const sources = <p className="small zakat-sources">
    {Object.entries(zakatSources).map(([key, href]) => <a key={key} href={href} rel="noreferrer">{t(key, { ref: 1454 })}</a>)}
  </p>;
  const info = <><p>{t("zakatPriceNote")}</p><p className="muted">{t(desktop ? "zakatJewelleryNote" : "zakatWornNote")}</p>{sources}</>;
  const payments = <Payments profile={profile} hawl={hawl} due={result.due} money={money}
    formatDate={date => hijriDate(hijriOn(date, settings.hijriAdjust, calendar.anchors))} desktop={desktop} />;
  const paymentButton = <button type="button" className={"action " + (desktop ? "light" : "zakat-payment-primary")}
    onClick={() => open({ type: "payment" })}>{t("zakatLog")}</button>;
  const summary = <section className="card night zakat-summary compact-stack">
    <h2 className="caption">{t(desktop ? "zakatDue" : "zakatEstimated")}</h2>
    <div className="zakat-figure" aria-live="polite">
      <strong>{money(result.due)}</strong>
      {!desktop && <span className="muted">{rate}</span>}
    </div>
    {desktop ? <>
      <p className="small muted">{result.net === undefined ? t("zakatRate", { rate }) : t("zakatRateAmount", { rate, net: money(result.net) })}</p>
      {switcher}
      <dl className="zakat-breakdown">
        <div><dt>{t("zakatNisabLabel", { metal: t(metalLabels[profile.basis]) })}</dt><dd>{money(result.nisab)}</dd></div>
        <div><dt>{t("zakatNet")}</dt><dd>{money(result.net)}</dd></div>
        <div><dt>{t("zakatStatus")}</dt><dd>{status}</dd></div>
      </dl>
    </> : <p className="small muted">{dateText}</p>}
    <div className="equal-row zakat-hero-actions">
      {paymentButton}
      {desktop ? <Link className="action zakat-night-action" to="/print/zakat-summary">{t("zakatPrint")}</Link>
        : <button type="button" className="action light" onClick={remind}>{t("zakatReminder")}</button>}
    </div>
  </section>;
  let body: ReactNode;
  if (desktop) {
    const panels = <>
      {summary}{payments}
      <p className="small muted">{t("zakatCalculatorNote")}</p>
      {hawl?.shorterMonth && <p className="small muted">{t("zakatShortMonth")}</p>}
      <div className="zakat-desktop-links">
        <button className="text-button" type="button" onClick={remind}>{t("zakatReminder")}</button>
        <button className="text-button" type="button" onClick={openSettings}>{t("zakatSettings")}</button>
      </div>
    </>;
    body = <div className="zakat-desktop" data-wide={fullDesktop}>
      {!fullDesktop && <details className="zakat-compact-summary">
        <summary className="card">{t("zakatDue")} <strong><bdi>{money(result.due)}</bdi></strong></summary>
        <div className="zakat-aside">{panels}</div>
      </details>}
      <div className="zakat-groups">
        <section className="card compact-stack">
          <div className="row-between"><h2>{t("zakatCash")}</h2><button type="button" className="text-button" onClick={() => open({ type: "asset", kind: "cash" })}>+ {t("zakatAccount")}</button></div>
          {balanceRows("cash", t("zakatCashAtHome"))}
        </section>
        <section className="card compact-stack">
          <div className="row-between"><h2>{t("zakatMetals")}</h2><button type="button" className="text-button" onClick={openSettings}>
            {t("zakatUnitValue", { unit: t(profile.unit === "g" ? "zakatGramShort" : "zakatBhoriShort") })}
          </button></div>
          <div className="equal-row zakat-metal-tiles">{metalKinds.map(basis => {
            const holdings = weighed.filter(({ asset }) => asset.kind === "metal" && asset.basis === basis);
            const grams = holdings.reduce((sum, { asset }) => asset.kind === "metal" ? sum + asset.weight * unitGrams(asset.unit) : sum, 0);
            const total = holdings.some(item => item.value === undefined) ? undefined : holdings.reduce((sum, { value }) => sum + (value ?? 0), 0);
            const rate = prices[basis];
            return <div key={basis} className="zakat-metal-tile">
              <div className="row-between"><h3>{t(metalLabels[basis])}</h3><strong><bdi>{money(total)}</bdi></strong></div>
              <p className="small">{profile.unit === "bhori" ? weight(grams / unitGrams("bhori"), "bhori") + " ≈ " : ""}{weight(grams, "g")}</p>
              <button type="button" className="text-button" onClick={openSettings}>{rate ? money(rate) + " / " + t("zakatGramShort") : t("zakatSetPrice")}</button>
              {holdings.map(({ asset, value }) => <div key={asset.id}>{assetRow(asset, value)}</div>)}
              <button type="button" className="text-button" onClick={() => open({ type: "asset", kind: "metal", basis })}>+ {t("zakatAdd")}</button>
            </div>;
          })}</div>
          {(profile.metals > 0 || result.assets.some(item => item.asset.kind === "metals")) && balanceRows("metals", t("zakatMetalValue"))}
          <div className="small zakat-information">{info}</div>
        </section>
        <section className="card compact-stack">
          <div className="row-between"><h2>{t("zakatOther")}</h2><button type="button" className="text-button" onClick={() => open({ type: "asset", kind: "receivables" })}>+ {t("zakatAdd")}</button></div>
          {(["receivables", "trade", "debt"] as const).map(field => balanceRows(field))}
        </section>
      </div>
      {fullDesktop && <aside className="zakat-aside">{panels}</aside>}
    </div>;
  } else {
    body = <>
      <SectionNav title={t("zakat")} back="/plan" action={<button type="button" className="icon-button" onClick={openSettings} aria-label={t("zakatSettings")}>
        <DesignIcon name="surah-mobile-sliders" size={24} />
      </button>} />
      {summary}
      {hawl?.shorterMonth && <p className="small muted">{t("zakatShortMonth")}</p>}
      <section className="zakat-nisab compact-stack">
        <h2>{t("zakatNisab")}</h2>{switcher}
        <p className="small muted">{t(profile.basis === "silver" ? "zakatSilverNote" : "zakatGoldNote", { weight: nisabWeight("gold", "g") })}</p>
        {result.nisab === undefined ? <button type="button" className="text-button" onClick={openSettings}>
          {t("zakatPriceNeeded", { metal: t(metalLabels[profile.basis]).toLocaleLowerCase(language) })}</button>
          : <p className="sr-only">{t("zakatThreshold", { amount: money(result.nisab) })}</p>}
      </section>
      <section className="card zakat-holdings">
        <h2 className="caption">{t("zakatAssets")}</h2>
        <div>
          {balanceRows("cash")}
          {(!weighed.length || profile.metals > 0 || result.assets.some(item => item.asset.kind === "metals")) && balanceRows("metals")}
          {weighed.map(({ asset, value }) => <div key={asset.id}>{assetRow(asset, value)}</div>)}
          {(["trade", "receivables", "debt"] as const).map(field => balanceRows(field))}
        </div>
        <div className="row-between zakat-net"><span>{t("zakatNet")}</span><strong><bdi>{money(result.net)}</bdi></strong></div>
        {!result.complete && <p className="small muted">{t("zakatAssetsNeedPrices")}</p>}
        <button type="button" className="action soft" onClick={() => open({ type: "asset" })}>{t("zakatAdd")}</button>
      </section>
      <aside className="card tint zakat-information">{info}</aside>
      {payments}
    </>;
  }

  return <div className="zakat-page" data-desktop={desktop}>
    {body}
    <ZakatDialog editor={editor} profile={profile} day={day} close={() => setEditor(undefined)}
      restoreFocus={() => (trigger.current?.isConnected ? trigger.current : document.querySelector<HTMLElement>(".zakat-holdings .action, .zakat-groups .text-button"))?.focus()}
      paymentYear={(date, current) => hawlOn(date, current)?.year} />
  </div>;
}
