import { createRoot } from "react-dom/client";
import App from "./App";
import { listenForInstallPrompt } from "./lib/installPrompt";
import "./fonts-app.css";
import "./index.css";

listenForInstallPrompt();
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}app/sw.js`).catch(error => {
    console.error("Awwab could not prepare offline access.", error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
