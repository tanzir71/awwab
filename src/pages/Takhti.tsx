import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { PracticeHeader } from "@/components/PracticeHeader";
import { useSettings } from "@/hooks/use-awwab";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { studyNames } from "@/lib/study-copy";
import { saveTakhtiPractice } from "@/lib/studyMilestones";
import { compareTakhti, families, letterForms, lettersForFamily, tracingModel, type LetterForm, type TakhtiLetter, type TracePoint } from "@/lib/takhti";

const formLabels = { isolated: "writeAlone", initial: "writeStart", medial: "writeMiddle", final: "writeEnd" } as const;
const resultLabels = { empty: "writeEmpty", match: "writeMatched", shape: "writeShape", dots: "writeDots" } as const;
const nameOf = (letter: TakhtiLetter, language: string) => language === "bn" ? letter.nameBn : letter.name;

function TraceBoard({ letter, form, glyph, desk }: { letter: TakhtiLetter; form: LetterForm; glyph: string; desk?: boolean }) {
  const { language, t } = useCopy();
  const settings = useSettings();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number>();
  const strokes = useRef<TracePoint[][]>([]);
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof compareTakhti>>();
  const [hasInk, setHasInk] = useState(false);
  const model = tracingModel(letter, form, !desk);
  const name = nameOf(letter, language);
  const ba = !desk && letter.letter === "ب" && form === "isolated";
  const ra = desk && letter.family === "ra" && form === "isolated";
  const prefix = settings?.mode === "maktab" ? "takhti-maktab" : "takhti-phone";
  const start = model.paths[0][0];
  const feedback = result && t(result === "match" && ba ? "writeNice" : resultLabels[result]);

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
    if (pointer.current !== undefined || event.button !== 0 || strokes.current.length >= 32) return;
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

  function check() {
    const comparison = compareTakhti(strokes.current, model);
    setResult(comparison);
    if (comparison === "empty") return;
    setShow(true);
    const family = families.find(item => item.shapes.includes(letter.family));
    if (comparison === "match" && family && settings) {
      void saveTakhtiPractice(family.id, new Date(), settings.city.timeZone).catch(() => toast.error(t("saveError")));
    }
  }

  return <div className="write-board-stack">
    <div className={`write-board ${desk ? "write-board-desk" : "write-board-phone"}`}>
      {!desk && <p className="write-cue">{t(ba ? "writeBoatCue" : "writeStartCue")}</p>}
      <div className="write-ghost" aria-hidden="true" ref={node => node?.setAttribute("inert", "")}><ArabicText text={glyph} compact /></div>
      {desk ? <div className="write-rules" aria-hidden="true"><i /><i /><i /></div> :
        <DesignIcon className="write-baseline" name={prefix + "-line"} size={300} height={2} />}
      {(show || ra && !hasInk) && (ra ? <DesignIcon className="write-ra-guide" name="qaida-desk-strokeguide" size={80} height={110} /> :
        ba ? <DesignIcon className="write-ba-guide" name={prefix + "-frame"} size={250} height={140} /> :
        <svg className="write-model" viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden="true">
          {model.paths.map((path, i) => <polyline key={i} points={path.map(point => point.join(",")).join(" ")} />)}
          {model.dots.map(([x, y]) => <circle key={x + "," + y} cx={x} cy={y} r="5" />)}
        </svg>)}
      {ra ? <span className="write-ra-start" aria-hidden="true"><DesignIcon name="qaida-desk-ellipse" size={22} /><b>1</b></span> :
        <span className="write-guide-dot" style={{ left: `${start[0] / 3.2}%`, top: `${start[1] / 2}%` }} aria-hidden="true">1</span>}
      {ba && <span className="write-ba-dot" aria-hidden="true"><img src={asset(`design/${prefix}-ellipse.png`)} width={18} height={18} alt="" /><b>2</b></span>}
      <canvas ref={canvas} width={640} height={400} aria-label={t("drawingBoard", { name })}
        onPointerDown={begin} onPointerMove={draw} onPointerUp={draw}
        onPointerCancel={() => { pointer.current = undefined; }} onLostPointerCapture={() => { pointer.current = undefined; }} />
    </div>
    {desk && <ol className="write-steps">
      {(ra ? ["writeRaStart", "writeRaCurve", "writeRaTail"] : ["writeStartCue", "writeFollowCue"]).map(key => <li key={key}>{t(key)}</li>)}
    </ol>}
    {desk && <p className="caption">{t("writeForms")}<span className="sr-only"> {name}</span></p>}
    {desk && <div className="write-form-preview" dir="rtl">{letterForms(letter).map(item => <div key={item.key}>
      <ArabicText text={item.text} compact /><small dir="auto">{t(formLabels[item.key])}</small>
    </div>)}</div>}
    {desk && !letter.joinsNext && <p className="small">{t("writeNonJoining", { name })}</p>}
    <div className="equal-row write-actions">
      <button className={`action ${desk ? "soft" : "light"}`} onClick={clear} disabled={!hasInk}>{t(desk ? "writeClear" : "washTakhti")}</button>
      {desk && <button className="action soft" onClick={() => setShow(value => !value)} aria-pressed={show}>{t(show ? "writeHide" : "writeShow")}</button>}
      <button className="action" onClick={check}>{t(desk ? "writeCompare" : "writeCheck")}</button>
    </div>
    {feedback && <div className="write-feedback" data-matched={result === "match"} role="status">
      <strong>{result === "match" && <DesignIcon name={prefix + "-check"} size={18} />}{feedback}</strong>
      <p>{t(ba ? "writeBoatTip" : "writeTraceTip")}</p>
    </div>}
    {desk && <p className="small muted">{t("writeInputs")}</p>}
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

export function Takhti() {
  const { language, t } = useCopy();
  const settings = useSettings();
  const { family } = useParams();
  const selected = families.find(item => item.id === family) ?? families[0];
  const letters = lettersForFamily(selected.id);
  const [params, setParams] = useSearchParams();
  const letter = letters.find(item => item.letter === params.get("letter")) ?? letters[0];
  const forms = letterForms(letter);
  const active = forms.find(item => item.key === params.get("form")) ?? forms[0];
  return <div className="write-standalone">
    <PracticeHeader title={t("writeLabel")} back="/learn" maktab={settings?.mode === "maktab"} />
    <section className="card write-family">
      <p className="caption">{t("writeFamily", { number: families.indexOf(selected) + 1, total: families.length })}</p>
      <h2>{selected.id === "boat" ? t("writeBoatFamily") : studyNames.family(language, selected.id, selected.title)}</h2>
      <div className="equal-row write-letter-picks" role="group" aria-label={t("chooseLetter")} dir="rtl">
        {letters.map(item => <div key={item.letter} data-current={item === letter}><ArabicText text={item.letter} selectedPosition={item === letter ? 1 : 0}
          onWordSelected={() => {
            if (item === letter) return;
            setParams({ letter: item.letter }, { replace: true });
            return false;
          }} /></div>)}
      </div>
    </section>
    <div className="equal-row write-form-picks" dir="rtl" role="group" aria-label={t("writeForms")}>
      {forms.map(item => <div data-current={item === active} key={item.key}>
        <ArabicText text={item.text} selectedPosition={item === active ? 1 : 0} onWordSelected={() => {
          if (item === active) return;
          setParams({ letter: letter.letter, form: item.key }, { replace: true });
          return false;
        }} />
        <span dir="auto">{t(formLabels[item.key])}</span>
      </div>)}
    </div>
    <TraceBoard key={letter.letter + active.key} letter={letter} form={active.key} glyph={active.text} />
    {selected.id === "boat" && <section className="card write-word">
      <h2>{t("writeWholeWord")}</h2>
      <div dir="rtl"><ArabicText text="بـ" compact /><span>+</span><ArabicText text="ـيـ" compact /><span>+</span><ArabicText text="ـت" compact /><span>=</span><strong><ArabicText text="بَيْت" compact /></strong></div>
      <p className="small muted">{t("writeBayt")}</p>
    </section>}
    <details className="write-family-links">
      <summary>{t("letterFamilies")}</summary>
      <nav className="chips" aria-label={t("letterFamilies")}>{families.map(item => <Link key={item.id} className={`chip ${item === selected ? "soft" : ""}`}
        to={`/learn/takhti/${item.id}`} aria-current={item === selected ? "page" : undefined}>{studyNames.family(language, item.id, item.title)}</Link>)}</nav>
    </details>
    <Link to={`/print/takhti/${selected.id}`} className="action soft">{t("printPracticeSheet")}</Link>
  </div>;
}
