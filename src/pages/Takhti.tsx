import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Eraser, Eye, PenLine } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { SectionNav } from "@/components/Surface";
import { families, lettersForFamily, strokesForLetter } from "@/lib/takhti";

type Letter = ReturnType<typeof lettersForFamily>[number];

export function TraceBoard({ letter, printable = false }: { letter: Letter; printable?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const guide = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number>();
  const previous = useRef<{ x: number; y: number }>();
  const [show, setShow] = useState(true);

  function clear() {
    const context = canvas.current?.getContext("2d");
    if (context) context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  }

  useEffect(() => {
    const context = guide.current?.getContext("2d");
    if (!context) return;
    const styles = getComputedStyle(document.documentElement);
    context.clearRect(0, 0, 640, 400);
    context.save();
    context.scale(2, 2);
    context.lineWidth = 1;
    context.strokeStyle = styles.getPropertyValue("--c-ink-muted");
    context.globalAlpha = .4;
    context.setLineDash([8, 6]);
    for (const y of [80, 145, 181]) {
      context.beginPath(); context.moveTo(19, y); context.lineTo(301, y); context.stroke();
    }
    if (show || printable) {
      const { paths, dots } = strokesForLetter(letter);
      context.globalAlpha = .7;
      context.lineWidth = 5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = styles.getPropertyValue("--c-ink-muted");
      context.fillStyle = styles.getPropertyValue("--c-ink");
      context.setLineDash([7, 6]);
      paths.forEach((path, index) => {
        context.beginPath();
        context.moveTo(...path[0]);
        for (const position of path.slice(1)) context.lineTo(...position);
        context.stroke();
        context.beginPath();
        context.arc(path[0][0], path[0][1], 5, 0, Math.PI * 2);
        context.fill();
        context.font = "700 12px sans-serif";
        context.fillText(String(index + 1), path[0][0] + 7, path[0][1] - 7);
      });
      dots.forEach(([x, y], index) => {
        context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2); context.fill();
        context.fillText(String(paths.length + index + 1), x + 5, y + 11);
      });
    }
    context.restore();
  }, [letter, printable, show]);

  useEffect(clear, [letter]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 640 / rect.width, y: (event.clientY - rect.top) * 400 / rect.height };
  }
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const current = point(event);
    const last = previous.current ?? current;
    const styles = getComputedStyle(document.documentElement);
    context.lineCap = "round"; context.lineJoin = "round"; context.lineWidth = 8;
    context.strokeStyle = styles.getPropertyValue("--c-ink");
    context.beginPath(); context.moveTo(last.x, last.y); context.lineTo(current.x + .01, current.y); context.stroke();
    previous.current = current;
  }

  return <div className="compact-stack">
    <div className="trace-board">
      <canvas ref={guide} width={640} height={400} aria-label={`Tracing guide for ${letter.name}`} />
      {!printable && <canvas ref={canvas} width={640} height={400} aria-label={`Drawing board for ${letter.name}`}
        onPointerDown={event => {
          if (pointer.current !== undefined || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = event.pointerId;
          draw(event);
        }}
        onPointerMove={draw}
        onLostPointerCapture={() => { pointer.current = undefined; previous.current = undefined; }} />}
    </div>
    {!printable && <div className="equal-row">
      <button className="action light" onClick={clear}><Eraser size={18} /> Wash the takhti</button>
      <button className="action soft" aria-pressed={show} onClick={() => setShow(value => !value)}><Eye size={18} /> {show ? "Hide guide" : "Show me"}</button>
    </div>}
  </div>;
}

export function Takhti() {
  const { family } = useParams();
  const selected = families.find(item => item.id === family) ?? families[0];
  const letters = lettersForFamily(selected.id);
  const [pick, setPick] = useState("");
  const letter = letters.find(item => item.letter === pick) ?? letters[0];
  return <div className="stack">
    <SectionNav title="Takhti · writing" back="/learn" />
    <p className="muted">Follow the start dot and trace the letter with your finger, mouse or stylus.</p>
    <div className="chips" aria-label="Letter families">{families.map(item => <Link key={item.id} className={`chip ${item.id === selected.id ? "soft" : ""}`} to={`/learn/takhti/${item.id}`}>{item.title}</Link>)}</div>
    <section className="card stack">
      <h2 className="with-icon"><PenLine size={19} /> {selected.title}</h2>
      <div className="equal-row" aria-label="Choose a letter">{letters.map(item => <button key={item.letter} className={`action ${item === letter ? "" : "light"}`} type="button" aria-pressed={item === letter} onClick={() => setPick(item.letter)}>{item.name}</button>)}</div>
      <ArabicText text={letter.letter} />
      <TraceBoard letter={letter} />
    </section>
    <Link to={`/print/takhti/${selected.id}`} className="action soft"><Download size={18} /> Print a practice sheet</Link>
  </div>;
}
