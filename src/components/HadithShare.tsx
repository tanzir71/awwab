import { useMemo, useState } from "react";
import { ShareArtwork, type ShareArtifact } from "@/components/ShareArtwork";
import { SHARE_URL } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { downloadFile } from "@/lib/download";
import type { ShareModel } from "@/lib/share";

export interface HadithShareData {
  title: string;
  reference: string;
  source: string;
  text: string;
  arabic?: string;
  summary: boolean;
}

export function HadithShare({ data }: { data: HadithShareData }) {
  const { t } = useCopy();
  const [artifact, setArtifact] = useState<ShareArtifact>();
  const badge = t(data.summary ? "hadithShareSummary" : "hadithExcerpt");
  const model = useMemo<ShareModel>(() => ({ template: "hadith", format: "post", light: true, showPrayerNumbers: false,
    card: { badge, title: data.title, detail: data.text, arabic: data.arabic, citation: data.reference,
      note: data.source.replace(/^https:\/\//, "") },
  }), [badge, data]);
  const file = artifact?.model === model ? artifact.file : undefined;
  const failed = artifact?.model === model && artifact.failed;

  async function share() {
    if (!file) return;
    const files = [file];
    try {
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: data.title, text: `${data.reference}\n${data.source}`, url: SHARE_URL });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    downloadFile(file, file.name);
  }

  return <div className="hadith-share">
    <ShareArtwork model={model} onArtifact={setArtifact} label={t("hadithShareCaption", { reference: data.reference })} />
    {failed && <p role="status">{t("hadithShareError")}</p>}
    <div className="equal-row">
      <button className="action soft" type="button" disabled={!file} onClick={() => { if (file) downloadFile(file, file.name); }}>{t("shareSave")}</button>
      <button className="action" type="button" disabled={!file} onClick={() => void share()}>{t("hadithShareImage")}</button>
    </div>
  </div>;
}
