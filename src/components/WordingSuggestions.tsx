import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { downloadFile } from "@/lib/download";
import { updateRecord } from "@/lib/storageService";
import type { AppLanguage } from "@/lib/languagePreferences";

type Suggestion = { language: AppLanguage; page: string; original: string; proposed: string };
type FormRequest = Omit<Suggestion, "proposed">;
const key = "wording-suggestions";
const maxSuggestions = 300;
const eventName = "awwab-wording-suggestion";

export function WordingSuggestionCard() {
  const { language, t } = useCopy();
  const { pathname } = useLocation();
  const suggestions = useRecord<Suggestion[]>(key, []);
  return <section className="card compact-stack settings-suggestion-card">
    <h2>{t("settingsSuggestionTitle")}</h2>
    <p className="small">{t("settingsSuggestionHint")}</p>
    <button type="button" className="text-button" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent<FormRequest>(eventName, {
      detail: { language, page: pathname, original: "" },
    }))}>{t("settingsSuggest")}</button>
    {suggestions.length > 0 && <button type="button" className="text-button" onClick={() => {
      downloadFile(new Blob([JSON.stringify(suggestions, null, 2)], { type: "application/json" }), "awwab-wording-suggestions.json");
    }}>{t("settingsExportSuggestions")}</button>}
  </section>;
}

export function WordingSuggestionLayer() {
  const { language, t } = useCopy();
  const { pathname } = useLocation();
  const [form, setForm] = useState<FormRequest>();
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function open(event: CustomEvent<FormRequest>) {
      setStatus("");
      setForm(event.detail);
    }
    window.addEventListener(eventName, open as EventListener);
    return () => window.removeEventListener(eventName, open as EventListener);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let point: { x: number; y: number } | undefined;
    const clear = () => { window.clearTimeout(timer); point = undefined; };
    function start(event: PointerEvent) {
      if (event.pointerType !== "touch" || !(event.target instanceof HTMLElement) || form) return;
      const target = event.target;
      if (target.closest('a, button, input, textarea, select, label, [contenteditable], [lang="ar"], [role="dialog"]')) return;
      const text = target.closest("p, h1, h2, h3, dd, dt, legend, span")?.textContent?.trim();
      if (!text || text.length > 500) return;
      clear();
      point = { x: event.clientX, y: event.clientY };
      timer = window.setTimeout(() => toast(t("settingsSuggestionTitle"), {
        action: { label: t("settingsSuggest"), onClick: () => {
          setStatus("");
          setForm({ language, page: pathname, original: text });
        } },
      }), 620);
    }
    function move(event: PointerEvent) {
      if (point && Math.hypot(event.clientX - point.x, event.clientY - point.y) > 10) clear();
    }
    document.addEventListener("pointerdown", start);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", clear);
    document.addEventListener("pointercancel", clear);
    document.addEventListener("scroll", clear, true);
    return () => {
      clear();
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", clear);
      document.removeEventListener("pointercancel", clear);
      document.removeEventListener("scroll", clear, true);
    };
  }, [form, language, pathname, t]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || saving) return;
    const input = new FormData(event.currentTarget);
    const original = String(input.get("original") ?? "").trim();
    const proposed = String(input.get("proposed") ?? "").trim();
    if (!original || !proposed) return;
    let full = false;
    setSaving(true);
    try {
      await updateRecord<Suggestion[]>(key, [], saved => {
        full = saved.length >= maxSuggestions;
        return full ? saved : [...saved, { ...form, original, proposed }];
      });
      if (full) setStatus(t("settingsSuggestionFull"));
      else { setForm(undefined); toast.success(t("settingsSuggestionSaved")); }
    } catch { setStatus(t("saveError")); }
    finally { setSaving(false); }
  }

  return <Dialog open={Boolean(form)} onOpenChange={open => { if (!open && !saving) setForm(undefined); }}>
    {form && <DialogContent className="awwab-dialog">
      <DialogTitle>{t("settingsSuggest")}</DialogTitle>
      <DialogDescription>{t("settingsSuggestionHint")}</DialogDescription>
      <form className="stack" onSubmit={save}>
        <label className="field">{t("settingsOriginalText")}<textarea name="original" required maxLength={500} rows={3} defaultValue={form.original} /></label>
        <label className="field">{t("settingsSuggestedText")}<textarea name="proposed" required maxLength={500} rows={3} /></label>
        {status && <p role="alert">{status}</p>}
        <button className="action" type="submit" disabled={saving}>{t("settingsSaveSuggestion")}</button>
      </form>
    </DialogContent>}
  </Dialog>;
}
