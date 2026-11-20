import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("browser installation", () => {
  let target: EventTarget;

  beforeEach(() => {
    vi.resetModules();
    target = new EventTarget();
    vi.stubGlobal("window", target);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("notifies the install page when a late prompt arrives and is consumed", async () => {
    const { installPromptState, listenForInstallPrompt, subscribeToInstallPrompt, takeInstallPrompt } = await import("./installPrompt");
    listenForInstallPrompt();
    const states: string[] = [];
    const unsubscribe = subscribeToInstallPrompt(() => states.push(installPromptState()));
    expect(installPromptState()).toBe("unavailable");

    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    target.dispatchEvent(prompt);
    expect(prompt.defaultPrevented).toBe(true);
    expect(takeInstallPrompt()).toBe(prompt);
    expect(takeInstallPrompt()).toBeUndefined();
    expect(states).toEqual(["available", "unavailable"]);

    unsubscribe();
    target.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true }));
    expect(installPromptState()).toBe("available");
    expect(states).toHaveLength(2);
  });

  it("clears the prompt and remembers installation when the route is not open", async () => {
    const { installPromptState, listenForInstallPrompt, takeInstallPrompt } = await import("./installPrompt");
    listenForInstallPrompt();
    target.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true }));
    target.dispatchEvent(new Event("appinstalled"));

    expect(installPromptState()).toBe("installed");
    expect(takeInstallPrompt()).toBeUndefined();
  });
});
