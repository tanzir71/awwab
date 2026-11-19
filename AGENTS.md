# AGENTS.md — instructions for coding agents (Codex)

You are building **Awwab** (formerly Prayer Quest): an offline-first PWA for Muslims returning to regular prayer and re-learning Quranic Arabic.

**Read first:** `docs/SPEC.md` (product and architecture). Then read `docs/design-tokens.json` and `docs/content/*.json`.
**Design source of truth:** https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest. Node IDs are in SPEC §5. Use the Figma MCP (`get_design_context`, `get_screenshot`) on those nodes when implementing a screen.

## Non-negotiables

1. **No backend, no accounts, no analytics.** Share images and share text use `SHARE_URL = https://tanzir71.github.io/awwab/` (SPEC §6.11).
    Static files on GitHub Pages only. After first load, everything must work **offline**.
2. **User data stays on the device** (IndexedDB via Dexie). Provide export and import of a backup file.
3. Prayer times are computed on the device with `adhan` (adhan-js). Do not call Aladhan or IP-lookup APIs.
4. **Reminders use `.ics` export**, not push. Location is **opt-in** and only used on the device.
5. **Every Arabic string renders through `<ArabicText>` → `WordChip`s**, and tapping a word opens **Word anatomy** (letters → sounds → joining → root → modern Arabic). Never render Quran or duʿā Arabic as a plain string.
6. **Theme tokens only:** map `docs/design-tokens.json` to CSS variables on `:root[data-mode="adult"|"maktab"]`.
   - **No borders on containers.** Use tonal fills and the shadow tokens.
   - Sibling buttons and cards in a row get **equal widths**.
7. Fonts:
   - Adult mode: Noto Serif (display) and Noto Sans (body).
   - Maktab mode: Baloo 2 and Nunito.
   - All learning and UI Arabic in both modes: **Noto Sans Arabic**.
   - The mushaf font follows the script setting (IndoPak or Uthmani).
8. Copy is **mercy-first**: no shame words ("failed", "broke your streak"). Streaks never reset to zero; "returns" are celebrated.
9. Religious data comes only from `docs/content/*` or from sources listed in SPEC §7. Always show sources (surah:āyah; hadith collection, number and grade). Never invent hadith, gradings or rulings. Where madhhabs differ, add a "scholars differ" note.

## Stack & commands

- Vite + React 18 + TypeScript + Tailwind + shadcn/ui (existing). Add `vite-plugin-pwa`, `dexie`, `zustand`, `adhan`, `ts-fsrs`. Add `maplibre-gl` and `pmtiles` lazily, for Umrah mode only.
- `npm install` · `npm run dev` · `npm run build` · `npm run lint` · `npm run test` (add Vitest).
- GitHub Pages:
  - the repo is `tanzir71/awwab` (renamed from `prayer-quest`); set `base: '/awwab/'` in `vite.config.ts` (site: https://tanzir71.github.io/awwab/);
  - use a SPA fallback (HashRouter or 404.html);
  - make the manifest `start_url` and `scope` relative;
  - add a `.github/workflows/deploy.yml`.

## Work plan

Follow the phases in SPEC §10. Start with **P0**, which includes the bug fixes in SPEC §11. Keep each phase shippable.

## Definition of done (per feature)

- Matches the Figma frame in **both** modes (Adult and Maktab). The desktop layout applies at ≥1024px.
- Works with the network disabled (DevTools → Offline) after one online load.
- Unit tests for the pure logic you touch:
  - Word anatomy (grapheme split with Quranic marks, silent alif waṣl, syllables, joining forms);
  - Hijri event shifting after a confirmation;
  - SRS scheduling;
  - zakat (nisab in grams and bhori, 2.5%);
  - qaḍāʾ estimator;
  - saʿy lap hysteresis.
- Lighthouse PWA installable; accessibility contrast is AA in both modes.
- No new network calls at runtime except opt-in pack downloads and share links.
