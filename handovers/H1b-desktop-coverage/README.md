# H1b · Desktop coverage

**Problem.** Only some screens had desktop designs (DA0–DA5, DM01–DM03). Everything else is being built by stretching or centring the phone layout. This handover gives every screen a desktop answer.

**Rule of thumb:** if a screen is not drawn, build it from the template it maps to (below). Never centre a 390px phone layout on a big screen. Never stretch a phone column to full width. Bottom sheets become dialogs or side panels.

Read first: **Desktop coverage & layout rules** frame [93:3738](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=93-3738) (page Desktop & Print).

## Shell (all Adult desktop screens)
- `Desktop/Sidebar (Adult · dense)` [40:1410](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=40-1410): variants `Active = Study plan · Paths · Qaida · Surahs · Word bank · Speak · Prayers · Return · Plan · Zakat · My mosques · Hadith · Umrah mode · Settings`. Groups LEARN / DAILY / TOOLS, a language chip and the "You & settings" row at the bottom.
- `Desktop/TopBar` [40:1411](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=40-1411): Title, Subtitle (Gregorian · Hijri · context), next-prayer chip, Start review, Log prayer, Share, notifications.
- Maktab desktop keeps the simple sidebar `Desktop/Sidebar` 24:128 (Learn first) and reuses these layouts with Maktab tokens.

## Templates
| Template | Layout | Frames |
|---|---|---|
| 1 Split | 520px night panel (brand, verse, steps) + content column (max 760), no sidebar | DC01, DC02 |
| 2 Dashboard | 4-column grid (280 + 16px gaps), widget cards with a title + action header | DA0, DA5 |
| 3 Workspace | list 232–260 · main fluid · side panel 300–400 | DA2, DA3, DC07 (H2: DA7) |
| 4 Form + summary | grouped fields (max 2 columns, inputs ≤ 480 wide) + sticky summary 340–400 | DC03, DC09, DC11 |
| 5 List–detail | filters/list · detail 360–400 | DC05, DC08, DA4 |
| 6 Calendar | month grid fluid + side panel 340 | DC04 |
| 7 Dialog | max 880; preview left, options right; Esc closes | DC10 |

## Frames to build
| Frame | Screen | Figma | Must have |
|---|---|---|---|
| DC01 | Onboarding: how you learn | [85:1614](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=85-1614) | Split layout; step list (Language · How you learn · Quick check · Prayer times); Adult/Maktab cards side by side with a live sample; script + spelling segmented controls; language chip top right; Back / Continue. Same flow for Welcome (step 1 = language) and Prayer times (step 4). |
| DC02 | Onboarding: quick check | [85:1728](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=85-1728) | One question per screen in a large card; Hear it / Show letters; three equal answers; 8-dot progress; "Skip: start from the beginning". |
| DC03 | Zakat calculator | [86:1634](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=86-1634) | Grouped fields (cash & bank, gold & silver with unit select bhori/tola/g and **user-entered** price per gram, other assets & debts) + sticky night summary (zakat due, 2.5% of net, silver/gold nisab toggle, nisab value, status, Log a payment, Print). Payments table with remaining. "A calculator, not a fatwa." Lakh grouping for BDT (`Intl.NumberFormat('en-IN')` or locale). |
| DC04 | Plan · calendar | [86:1893](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=86-1893) | Month grid (Sun first for BD; locale-aware), Hijri day in each cell, moon-dependent events marked ~ and shown on **both** possible days, Jumuʿah time on Fridays, Export .ics. Side panel: moon-dependent card (confirm source chips, shift ±1), Coming up, Where will you pray Eid. Clicking a day/event opens it in the side panel (desktop version of A16b). |
| DC05 | My mosques | [87:1924](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=87-1924) | Mosques table (role, jamaat per prayer, last checked; stale = danger text + banner with Ask on WhatsApp), weekly plan matrix (prayer × weekday → mosque), detail panel (board photo, times, Jumuʿah, last Eid jamaats, "I checked today"). |
| DC06 | Return & qaḍāʾ | [87:2299](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=87-2299) | Istighfar ring (Space = +1), Sayyid al-Istighfār line path; qaḍāʾ KPIs + per-prayer table with progress and +1; missed fasts; returns history; four steps; hope verse. Scholars-differ note. |
| DC07 | How to pray | [88:2216](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=88-2216) | Prayer list · rakʿah tabs with numbered steps (position, instruction, Arabic as WordChips + transliteration) · at-a-glance, Lost count (Muslim 571 + Hanafi practice note), Word by word link. |
| DC08 | Hadith | [88:2505](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=88-2505) | Filters (grade, topic, collection) · list cards with grade pill and reference · detail (Arabic, English, collection/grade/narrator/topic, Word anatomy, Copy reference, Share image). Unverified search → "we can't verify this". |
| DC09 | You & settings | [89:2511](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=89-2511) | Left category list · panel. Language & words panel is drawn (ships with H2; until then show English only and hide the panel). |
| DC10 | Share dialog | [90:2813](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=90-2813) | Dialog over the current page; preview carousel left; template, size, toggles (prayer numbers **off** by default), Save image · Copy link · Share…. |
| DC11 | Prepare for Umrah | [89:2789](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=89-2789) | Desktop is for preparation: trip, offline packs with sizes, checklist, phrase practice, Export trip file / Print pocket guide. Umrah mode itself stays phone-only; opening `/umrah` on desktop shows this page. |

Already designed (keep): DA0 Study plan 58:768 · DA2 Surah study 41:851 · DA3 Qaida + Takhti 59:899 · DA4 Word bank 60:1031 · DA5 Prayers 41:387 · DM01 63:1172 · DM02 24:319 · DM03 24:129.

## Rules
- Breakpoints: ≥1280 full layout · 1024–1279 the right panel becomes a drawer (or tabs) · <1024 phone layout.
- Density: body 13/18, small 12/16, caption 10; widget padding 16; zebra rows by tonal fill, never borders.
- Siblings in a row share width and height. Inputs never wider than 480.
- Interaction: hover on rows, focus rings, Ctrl K search, Esc closes, J/K moves in lists, Space adds istighfar on Return.
- Dialogs replace phone bottom sheets; toasts replace phone snackbars.
- RTL locales (H2) mirror the whole shell, sidebar on the right.

## Definition of done
- Every route renders a designed desktop layout at 1280 and 1440, and degrades to the drawer variant at 1024.
- Visual QA against each frame (Playwright screenshots at 1440×900 committed to `docs/qa/desktop/`).
- No route shows a centred phone column or full-width stretched phone cards.
- Keyboard: Tab order sensible, Esc closes dialogs/drawers, Ctrl K opens search.
