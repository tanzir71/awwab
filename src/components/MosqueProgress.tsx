const stages = ["Foundation", "Walls", "Dome", "Minarets", "Complete"];
const thresholds = [0, 20, 40, 65, 85];

export default function MosqueProgress({ consistency, dimmed }: { consistency: number; dimmed: boolean }) {
  const stage = thresholds.filter(value => consistency >= value).length;
  return <section className="card night compact-stack text-center">
    <div className="masjid" aria-hidden="true" style={{ opacity: dimmed ? .78 : 1 }}>
      {stage >= 4 && <><i className="minaret" /><i className="minaret right" /></>}
      {stage >= 3 && <><i className="dome" /><i className="spike" /></>}
      {stage >= 2 && <><i className="wall" /><i className="door" /></>}
      <i className="foundation" />
    </div>
    <strong>Stage {stage} of 5 · {stages[stage - 1]}</strong>
    <p className="muted small">Built from consistency, one prayer at a time. A missed day dims the lamps.</p>
  </section>;
}
