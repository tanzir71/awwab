import { ArabicText } from "@/components/ArabicText";
import { useCopy } from "@/lib/copy";
import { asset } from "@/lib/config";
import duas from "../../docs/content/umrah-duas.json";

export function UmrahTawafDiagram() {
  const { t } = useCopy();
  return <div className="umrah-tawaf-diagram" role="img"
    aria-label={`${t("umrahGuideDiagram")} · ${t("umrahPracticeCounterClockwise")} · ${t("umrahPracticeStone")}`}>
    <div className="umrah-tawaf-canvas" aria-hidden="true" dir="ltr">
      <div className="umrah-tawaf-art">
        <img className="umrah-tawaf-track" src={asset("design/umrah-practice-track.svg")} alt="" />
        <img className="umrah-tawaf-arc" src={asset("design/umrah-practice-arc.svg")} alt="" />
        <span className="umrah-tawaf-kaaba" />
        <img className="umrah-tawaf-stone" src={asset("design/umrah-practice-stone.svg")} alt="" />
        <span className="umrah-tawaf-stone-label" dir="auto">{t("umrahPracticeStone")}</span>
        <span className="umrah-tawaf-maqam" />
        <span className="umrah-tawaf-maqam-label" dir="auto">{t("umrahPracticeMaqam")}</span>
        <img className="umrah-tawaf-direction" src={asset("design/umrah-practice-direction.svg")} alt="" />
      </div>
    </div>
  </div>;
}

export function UmrahRitualSources({ sources }: { sources: readonly { label: string; url: string }[] }) {
  return <span className="umrah-ritual-sources">
    {sources.map((source, i) => <span key={source.url}>{i > 0 && " · "}<a href={source.url} rel="noreferrer">{source.label}</a></span>)}
  </span>;
}

export function UmrahRitualDua({ kind }: { kind: "good" | "talbiyah" }) {
  const { t, language } = useCopy();
  const dua = duas[kind];
  return <section className="umrah-ritual-dua tint">
    <h2 className="caption">{t(kind === "good" ? "umrahPracticeDua" : "umrahStep-talbiyah")}</h2>
    <ArabicText text={dua.arabic} citation={dua.source} />
    <p className="small" lang={language === "bn" ? "bn" : "en"}>{language === "bn" ? dua.meaningBn : dua.meaning}</p>
    <p className="small"><UmrahRitualSources sources={[
      { label: dua.source, url: dua.url }, ...(kind === "good" ? [duas.good.practice] : []),
    ]} /></p>
  </section>;
}
