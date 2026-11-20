import { useEffect, useState } from "react";
import { useCopy } from "@/lib/copy";
import { takeInstallPrompt } from "@/lib/installPrompt";

export default function AppInstallPrompt() {
  const { t } = useCopy();
  const [installed, setInstalled] = useState(() => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);
  const [instructions, showInstructions] = useState(false);

  useEffect(() => {
    const done = () => setInstalled(true);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (installed) return null;
  async function install() {
    const prompt = takeInstallPrompt();
    if (!prompt) { showInstructions(true); return; }
    try {
      await prompt.prompt();
      setInstalled((await prompt.userChoice).outcome === "accepted");
    } catch {
      showInstructions(true);
    }
  }

  return <section className="card stack" id="install">
    <h2>{t("installTitle")}</h2>
    {instructions
      ? <div className="compact-stack">
          <p><strong>{t("installApple")}</strong> {t("installAppleHelp")}</p>
          <p><strong>{t("installAndroid")}</strong> {t("installAndroidHelp")}</p>
          <p><strong>{t("installComputer")}</strong> {t("installComputerHelp")}</p>
        </div>
      : <button className="action soft" onClick={() => void install()}>{t("installAction")}</button>}
  </section>;
}
