const picker = document.querySelector<HTMLDetailsElement>(".landing-language")!;
const summary = picker.querySelector("summary")!;
const status = picker.querySelector<HTMLParagraphElement>(".landing-language-status")!;
const root = document.documentElement;
const appPath = import.meta.env.BASE_URL + "app/";
const bindings = ["copy", "alt", "aria-label", "content"] as const;

function switchPage(page: Document, language: string) {
  if (page.documentElement.lang !== language) throw new Error("The requested language was unavailable");
  const updates = bindings.flatMap(binding => {
    const selector = `[data-landing-${binding}]`;
    const copies = new Map(Array.from(page.querySelectorAll(selector), element => [
      element.getAttribute(`data-landing-${binding}`),
      binding === "copy" ? element.textContent : element.getAttribute(binding),
    ]));
    return Array.from(document.querySelectorAll(selector), element => {
      const value = copies.get(element.getAttribute(`data-landing-${binding}`));
      if (value == null) throw new Error("Landing page languages are from different builds");
      return () => {
        if (binding === "copy") element.textContent = value;
        else element.setAttribute(binding, value);
      };
    });
  });
  for (const update of updates) update();

  document.getElementById("landing-locale-fonts")!.textContent = page.getElementById("landing-locale-fonts")?.textContent ?? "";
  root.lang = language;
  root.dir = page.documentElement.dir;
  root.dataset.uiScript = page.documentElement.dataset.uiScript;
  const current = picker.querySelector("bdi[data-landing-current]")!;
  current.textContent = page.querySelector("[data-landing-current]")!.textContent;
  current.setAttribute("lang", language);
  current.setAttribute("data-locale-name", root.dataset.uiScript);
  for (const option of picker.querySelectorAll<HTMLAnchorElement>("[data-landing-language]")) {
    if (option.dataset.landingLanguage === language) option.setAttribute("aria-current", "page");
    else option.removeAttribute("aria-current");
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== appPath) continue;
    if (language === "en") url.searchParams.delete("language");
    else url.searchParams.set("language", language);
    link.href = url.pathname + url.search + url.hash;
  }
  const canonical = page.querySelector<HTMLLinkElement>("link[rel=canonical]")!.href;
  document.querySelector<HTMLLinkElement>("link[rel=canonical]")!.href = canonical;
  document.querySelector<HTMLMetaElement>('meta[property="og:url"]')!.content = canonical;
}

picker.addEventListener("click", async event => {
  const option = event.target instanceof Element
    ? event.target.closest<HTMLAnchorElement>("[data-landing-language]")
    : null;
  if (!option || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (picker.getAttribute("aria-busy") === "true") return;
  const language = option.dataset.landingLanguage!;
  if (language === root.lang) { picker.open = false; summary.focus(); return; }
  const url = new URL(option.href);
  picker.setAttribute("aria-busy", "true");
  status.textContent = document.getElementById("landing-language-loading")!.textContent;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Landing translation could not be loaded");
    switchPage(new DOMParser().parseFromString(await response.text(), "text/html"), language);
    url.hash = location.hash;
    history.replaceState(history.state, "", url);
    status.textContent = "";
    picker.open = false;
    summary.focus();
  } catch {
    status.textContent = document.getElementById("landing-language-error")!.textContent;
  } finally {
    picker.removeAttribute("aria-busy");
  }
});

for (const menu of document.querySelectorAll<HTMLDetailsElement>(".site-nav details")) {
  menu.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !menu.open) return;
    menu.open = false;
    menu.querySelector("summary")?.focus();
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const prepareOffline = () => {
    void navigator.serviceWorker.register(import.meta.env.BASE_URL + "landing-sw.js").catch(() => undefined);
  };
  if (document.readyState === "complete") prepareOffline();
  else window.addEventListener("load", prepareOffline, { once: true });
}
