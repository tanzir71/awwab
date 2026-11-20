export interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pending: InstallEvent | undefined;
let installed = false;
const listeners = new Set<() => void>();

export function installPromptState() {
  return installed ? "installed" : pending ? "available" : "unavailable";
}

export function subscribeToInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setPrompt(next?: InstallEvent) {
  pending = next;
  for (const listener of listeners) listener();
}

export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    setPrompt(event as InstallEvent);
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    setPrompt();
  });
}

export function takeInstallPrompt() {
  const event = pending;
  if (event) setPrompt();
  return event;
}
