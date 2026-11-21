import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { PracticeHeader } from "@/components/PracticeHeader";
import { useDesktop, useRecord, useSettings } from "@/hooks/use-awwab";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { focusListItem } from "@/lib/focusListItem";
import { studyNames } from "@/lib/study-copy";
import { saveTakhtiPractice } from "@/lib/studyMilestones";
import { compareTakhti, families, letterForms, lettersForFamily, tracingModel, type LetterForm, type TakhtiLetter, type TracePoint } from "@/lib/takhti";

const formLabels = { isolated: "writeAlone", initial: "writeStart", medial: "writeMiddle", final: "writeEnd" } as const;
const resultLabels = { empty: "writeEmpty", match: "writeMatched", shape: "writeShape", dots: "writeDots" } as const;
const nameOf = (letter: TakhtiLetter, language: string) => language === "bn" ? letter.nameBn : letter.name;

function StrokeInstructions({ letter, form }: { letter: TakhtiLetter; form: LetterForm }) {
  const { t } = useCopy();
  const ra = letter.family === "ra" && form === "isolated";
  const hasDots = Boolean(tracingModel(letter, form, false).dots.length);
  const steps = ra ? ["writeRaStart", "writeRaCurve", "writeRaTail"]
    : ["writeStartCue", hasDots ? "writeFollowCue" : "writeFollowShape"];
  return <ol className="write-steps">{steps.map(step => <li key={step}>{t(step)}</li>)}</ol>;
}

function TraceBoard({ letter, form, glyph, desk, separateGuide = false }: {
  letter: TakhtiLetter; form: LetterForm; glyph: string; desk?: boolean; separateGuide?: boolean;
}) {
  const { language, t } = useCopy();
  const settings = useSettings();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number>();
  const strokes = useRef<TracePoint[][]>([]);
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof compareTakhti>>();
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const model = tracingModel(letter, form, !desk);
  const name = nameOf(letter, language);
  const ba = !desk && letter.letter === "ب" && form === "isolated";
  const ra = desk && !separateGuide && letter.family === "ra" && form === "isolated";
  const prefix = settings?.mode === "maktab" ? "takhti-maktab" : "takhti-phone";
  const start = model.paths[0][0];
  const feedback = result && t(result === "match" && ba ? "writeNice" : resultLabels[result]);
  const outline = <>
    {model.paths.map((path, i) => <polyline key={i} points={path.map(point => point.join(",")).join(" ")} />)}
    {model.dots.map(([x, y]) => <circle key={x + "," + y} cx={x} cy={y} r="5" />)}
  </>;

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    context?.setTransform(2, 0, 0, 2, 0, 0);
  }, []);

  function clear() {
    const context = canvas.current?.getContext("2d");
    context?.clearRect(0, 0, 320, 200);
    strokes.current = [];
    setHasInk(false);
    setResult(undefined);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = strokes.current.at(-1);
    const context = canvas.current?.getContext("2d");
    if (pointer.current !== event.pointerId || !stroke || !context || stroke.length >= 160) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point: TracePoint = [
      Math.max(0, Math.min(320, (event.clientX - rect.left) * 320 / rect.width)),
      Math.max(0, Math.min(200, (event.clientY - rect.top) * 200 / rect.height)),
    ];
    const last = stroke.at(-1) ?? point;
    if (stroke.length && Math.hypot(last[0] - point[0], last[1] - point[1]) < 1.5) return;
    stroke.push(point);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = desk ? 5 : 7;
    context.beginPath();
    context.moveTo(...last);
    context.lineTo(point[0] + .01, point[1]);
    context.stroke();
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (saving || pointer.current !== undefined || event.button !== 0 || strokes.current.length >= 32) return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const styles = getComputedStyle(event.currentTarget);
    context.strokeStyle = styles.getPropertyValue(desk ? "--c-primary" : "--c-accent").trim();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = event.pointerId;
    strokes.current.push([]);
    setHasInk(true);
    setResult(undefined);
    draw(event);
  }

  async function check() {
    const comparison = compareTakhti(strokes.current, model);
    if (comparison !== "empty") setShow(true);
    const family = comparison === "match" && families.find(item => item.shapes.includes(letter.family));
    if (family && settings) {
      setSaving(true);
      try { await saveTakhtiPractice(family.id, new Date(), settings.city.timeZone); }
      catch { toast.error(t("saveError")); }
      finally { setSaving(false); }
    }
    setResult(comparison);
  }

  return <div className="write-board-stack">
    <div className={`write-board ${desk ? "write-board-desk" : "write-board-phone"}`}>
      {!desk && <p className="write-cue">{t(ba ? "writeBoatCue" : "writeStartCue")}</p>}
      {separateGuide ? <svg className="write-model-ghost" viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden="true">{outline}</svg> :
        <div className="write-ghost" aria-hidden="true" ref={node => node?.setAttribute("inert", "")}><ArabicText text={glyph} compact /></div>}
      {desk ? <div className="write-rules" aria-hidden="true"><i /><i /><i /></div> :
        <DesignIcon className="write-baseline" name={prefix + "-line"} size={300} height={2} />}
      {(show || ra && !hasInk) && (ra ? <DesignIcon className="write-ra-guide" name="qaida-desk-strokeguide" size={80} height={110} /> :
        ba ? <DesignIcon className="write-ba-guide" name={prefix + "-frame"} size={250} height={140} /> :
        <svg className="write-model" viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden="true">{outline}</svg>)}
      {ra ? <span className="write-ra-start" aria-hidden="true"><DesignIcon name="qaida-desk-ellipse" size={22} /><b>1</b></span> :
        <span className="write-guide-dot" style={{ left: `${start[0] / 3.2}%`, top: `${start[1] / 2}%` }} aria-hidden="true">1</span>}
      {ba && <span className="write-ba-dot" aria-hidden="true"><img src={asset(`design/${prefix}-ellipse.png`)} width={18} height={18} alt="" /><b>2</b></span>}
      <canvas ref={canvas} width={640} height={400} aria-label={t("drawingBoard", { name })}
        onPointerDown={begin} onPointerMove={draw} onPointerUp={draw}
        onPointerCancel={() => { pointer.current = undefined; }} onLostPointerCapture={() => { pointer.current = undefined; }} />
    </div>
    {desk && !separateGuide && <>
      <StrokeInstructions letter={letter} form={form} />
      <p className="caption">{t("writeForms")}<span className="sr-only"> {name}</span></p>
      <div className="write-form-preview" dir="rtl">{letterForms(letter).map(item => <div key={item.key}>
        <ArabicText text={item.text} compact /><small dir="auto">{t(formLabels[item.key])}</small>
      </div>)}</div>
      {!letter.joinsNext && <p className="small">{t("writeNonJoining", { name })}</p>}
    </>}
    <div className="equal-row write-actions">
      <button className={`action ${desk ? "soft" : "light"}`} onClick={clear} disabled={!hasInk || saving}>{t(desk ? "writeClear" : "washTakhti")}</button>
      {desk && <button className="action soft" onClick={() => setShow(value => !value)} aria-pressed={show}>{t(show ? "writeHide" : "writeShow")}</button>}
      <button className="action" onClick={() => void check()} disabled={saving}>{t(desk ? "writeCompare" : "writeCheck")}</button>
    </div>
    {feedback && <div className="write-feedback" data-matched={result === "match"} role="status">
      <strong>{result === "match" && <DesignIcon name={prefix + "-check"} size={18} />}{feedback}</strong>
      <p>{t(ba ? "writeBoatTip" : "writeTraceTip")}</p>
    </div>}
    {desk && !separateGuide && <p className="small muted">{t("writeInputs")}</p>}
  </div>;
}

export function TakhtiPanel({ letter, panelRef }: { letter: TakhtiLetter; panelRef: RefObject<HTMLElement> }) {
  const { language, t } = useCopy();
  const family = families.find(item => item.shapes.includes(letter.family));
  return <aside className="card write-desktop-panel" ref={panelRef} tabIndex={-1}>
    <div className="row-between"><h2>{t("writeLetter", { name: nameOf(letter, language) })}</h2>
      <Link to={`/print/takhti/${family?.id ?? "boat"}`}>{t("writePrint")}</Link></div>
    <TraceBoard key={letter.letter} letter={letter} form="isolated" glyph={letter.letter} desk />
  </aside>;
}

export function Takhti({ desktop }: { desktop: boolean }) {
  const { language, locale, direction, t } = useCopy();
  const settings = useSettings();
  const practised = useRecord<string[]>("takhti-practised", []);
  const wide = useDesktop(1280);
  const [tab, setTab] = useState("write");
  const writeTab = useRef<HTMLButtonElement>(null);
  const { family } = useParams();
  const selected = families.find(item => item.id === family) ?? families[0];
  const letters = lettersForFamily(selected.id);
  const [params, setParams] = useSearchParams();
  const letter = letters.find(item => item.letter === params.get("letter")) ?? letters[0];
  const forms = letterForms(letter);
  const active = forms.find(item => item.key === params.get("form")) ?? forms[0];
  const name = nameOf(letter, language);
  const familyHeading = selected.id === "boat" ? t("writeBoatFamily") : studyNames.family(language, selected.id, selected.title);
  const letterPicker = <section className={desktop ? "write-family" : "card write-family"}>
      <p className="caption">{t("writeFamily", { number: families.indexOf(selected) + 1, total: families.length })}</p>
      <h2>{familyHeading}</h2>
      <div className="equal-row write-letter-picks" role="group" aria-label={t("chooseLetter")} dir="rtl">
        {letters.map(item => <div key={item.letter} data-current={item === letter}><ArabicText text={item.letter} selectedPosition={item === letter ? 1 : 0}
          onWordSelected={() => {
            if (item === letter) return;
            setParams({ letter: item.letter }, { replace: true });
            return false;
          }} /></div>)}
      </div>
    </section>;
  const formPicker = <div className="equal-row write-form-picks" dir="rtl" role="group" aria-label={t("writeForms")}>
      {forms.map(item => <div data-current={item === active} key={item.key}>
        <ArabicText text={item.text} selectedPosition={item === active ? 1 : 0} onWordSelected={() => {
          if (item === active) return;
          setParams({ letter: letter.letter, form: item.key }, { replace: true });
          return false;
        }} />
        <span dir="auto">{t(formLabels[item.key])}</span>
      </div>)}
    </div>;
  const wholeWord = selected.id === "boat" && <section className="card write-word">
      <h2>{t("writeWholeWord")}</h2>
      <div dir="rtl"><ArabicText text="بـ" compact /><span>+</span><ArabicText text="ـيـ" compact /><span>+</span><ArabicText text="ـت" compact /><span>=</span><strong><ArabicText text="بَيْت" compact /></strong></div>
      <p className="small muted">{t("writeBayt")}</p>
    </section>;

  if (desktop) {
    const numbers = new Intl.NumberFormat(locale);
    const directory = <section className="card takhti-directory">
      <h2>{t("letterFamilies")}</h2>
      <nav aria-label={t("letterFamilies")} onKeyDown={event => focusListItem(event)}>
        {families.map((item, index) => <Link key={item.id} to={`/learn/takhti/${item.id}`}
          aria-current={item === selected ? "page" : undefined} data-practised={practised.includes(item.id)}
          onClick={() => {
            if (wide) return;
            setTab("write");
            writeTab.current?.focus();
          }}>
          <span className="takhti-family-number">{numbers.format(index + 1)}</span>
          <span>{studyNames.family(language, item.id, item.title)}</span>
          {practised.includes(item.id) && <span className="sr-only">{t("practised")}</span>}
        </Link>)}
      </nav>
    </section>;
    const board = <section className="card takhti-practice" aria-label={t("writeLetter", { name })}>
      <header className="row-between">
        <h2>{t("writeLetter", { name })}</h2>
        <Link className="text-button" to={`/print/takhti/${selected.id}`}>{t("writePrint")}</Link>
      </header>
      {letterPicker}
      {formPicker}
      <TraceBoard key={letter.letter + active.key} letter={letter} form={active.key} glyph={active.text} desk separateGuide />
    </section>;
    const reference = <aside className="takhti-reference">
      <section className="card compact-stack">
        <h2>{t("writeGuide")}</h2>
        <StrokeInstructions letter={letter} form={active.key} />
        {!letter.joinsNext && <p className="small">{t("writeNonJoining", { name })}</p>}
        <p className="small muted">{t("writeInputs")}</p>
      </section>
      {wholeWord}
    </aside>;
    return wide ? <div className="takhti-desktop takhti-workspace">{directory}{board}{reference}</div> :
      <Tabs.Root className="takhti-desktop workspace-tabs" dir={direction} value={tab} onValueChange={setTab}>
        <Tabs.List className="study-tabs equal-row" aria-label={t("takhtiWorkspace")}>
          <Tabs.Trigger value="write" ref={writeTab}>{t("qaidaWrite")}</Tabs.Trigger>
          <Tabs.Trigger value="guide">{t("writeGuide")}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="write" forceMount>{board}</Tabs.Content>
        <Tabs.Content className="takhti-guide-tab" value="guide" forceMount>{directory}{reference}</Tabs.Content>
      </Tabs.Root>;
  }

  return <div className="write-standalone">
    <PracticeHeader title={t("writeLabel")} back="/learn" maktab={settings?.mode === "maktab"} />
    {letterPicker}
    {formPicker}
    <TraceBoard key={letter.letter + active.key} letter={letter} form={active.key} glyph={active.text} />
    {wholeWord}
    <details className="write-family-links">
      <summary>{t("letterFamilies")}</summary>
      <nav className="chips" aria-label={t("letterFamilies")}>{families.map(item => <Link key={item.id} className={`chip ${item === selected ? "soft" : ""}`}
        to={`/learn/takhti/${item.id}`} aria-current={item === selected ? "page" : undefined}>{studyNames.family(language, item.id, item.title)}</Link>)}</nav>
    </details>
    <Link to={`/print/takhti/${selected.id}`} className="action soft">{t("printPracticeSheet")}</Link>
  </div>;
}
