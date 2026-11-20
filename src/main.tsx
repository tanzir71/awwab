import { createRoot } from "react-dom/client";
import App from "./App";
import { listenForInstallPrompt } from "./lib/installPrompt";
import { isAvailableLanguage } from "./lib/languagePreferences";
import { selectAppLanguage } from "./lib/storageService";
import "./fonts-app.css";
import "./index.css";

listenForInstallPrompt();
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}app/sw.js`).catch(error => {
    console.error("Awwab could not prepare offline access.", error);
  });
}

async function openAwwab() {
  const url = new URL(window.location.href);
  const language = url.searchParams.get("language");
  if (language) {
    url.searchParams.delete("language");
    window.history.replaceState(window.history.state, "", url);
    if (isAvailableLanguage(language)) await selectAppLanguage(language).catch(() => undefined);
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void openAwwab();
