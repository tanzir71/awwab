export interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pending: InstallEvent | undefined;

export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    pending = event as InstallEvent;
  });
  window.addEventListener("appinstalled", () => { pending = undefined; });
}

export function takeInstallPrompt() {
  const event = pending;
  pending = undefined;
  return event;
}
