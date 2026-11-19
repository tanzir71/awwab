import { useEffect, useRef } from "react";
import { drawShare, imageFile, shareFormats, type ShareModel } from "@/lib/share";

export type ShareArtifact = { model: ShareModel; file?: File; failed?: boolean };

export function ShareArtwork({ model, label, language, onArtifact }: {
  model: ShareModel; label?: string; language?: string; onArtifact?: (result: ShareArtifact) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dimensions = shareFormats[model.format];
  useEffect(() => {
    const surface = canvas.current;
    let current = true;
    async function render() {
      const rendered = document.createElement("canvas");
      await drawShare(rendered, model);
      if (!current || !surface) return;
      surface.width = rendered.width;
      surface.height = rendered.height;
      surface.getContext("2d").drawImage(rendered, 0, 0);
      if (onArtifact) {
        const file = await imageFile(rendered, model.template);
        if (current) onArtifact({ model, file });
      }
    }
    void render().catch(() => { if (current) onArtifact?.({ model, failed: true }); });
    return () => { current = false; };
  }, [model, onArtifact]);

  return <canvas className="share-artwork" ref={canvas} width={dimensions.width} height={dimensions.height}
    lang={language} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
