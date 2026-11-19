import { useEffect, useState } from "react";
import { takeInstallPrompt } from "@/lib/installPrompt";

export default function AppInstallPrompt() {
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
    <h2>Install awwab</h2>
    {instructions
      ? <div className="compact-stack">
          <p><strong>iPhone or iPad:</strong> Open Safari, tap Share, then Add to Home Screen.</p>
          <p><strong>Android:</strong> Open the browser menu and choose Install app or Add to Home screen.</p>
          <p><strong>Computer:</strong> Use the install icon in Chrome or Edge, or choose Add to Dock in Safari.</p>
        </div>
      : <button className="action soft" onClick={() => void install()}>Install the app</button>}
  </section>;
}
