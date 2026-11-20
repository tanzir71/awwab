import { useState, useSyncExternalStore } from "react";
import { useCopy } from "@/lib/copy";
import { installPromptState, subscribeToInstallPrompt, takeInstallPrompt } from "@/lib/installPrompt";

export default function AppInstallPrompt() {
  const { t } = useCopy();
  const [standalone] = useState(() => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);
  const [accepted, setAccepted] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const state = useSyncExternalStore(subscribeToInstallPrompt, installPromptState);

  if (standalone || accepted || state === "installed") return null;
  async function install() {
    const prompt = takeInstallPrompt();
    if (!prompt) return;
    setPrompting(true);
    try {
      await prompt.prompt();
      setAccepted((await prompt.userChoice).outcome === "accepted");
    } catch {
      // The instructions stay available when the browser cannot show its prompt.
    } finally {
      setPrompting(false);
    }
  }

  return <section className="card stack" id="install">
    <h2>{t("installTitle")}</h2>
    {(state === "available" || prompting) && <button type="button" className="action soft" disabled={prompting}
      onClick={() => void install()}>{t("installAction")}</button>}
    <div className="compact-stack">
      <p><strong>{t("installApple")}</strong> {t("installAppleHelp")}</p>
      <p><strong>{t("installAndroid")}</strong> {t("installAndroidHelp")}</p>
      <p><strong>{t("installComputer")}</strong> {t("installComputerHelp")}</p>
    </div>
  </section>;
}
