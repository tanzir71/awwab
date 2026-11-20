# Awwab — Product & Build Spec (v1)

> Formerly **Prayer Quest**. An installable, **fully offline**, **backend-free** PWA (GitHub Pages) for Muslims who pray irregularly and want to come back: prayer, return (tawbah), Quran & Arabic re-learning with every word spelled out, an Islamic year planner, and a dedicated Umrah mode.

Figma (source of truth): https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest
Link to a node: `https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=<id with - instead of :>`

---

## 1. Who it's for

"Irregular" Muslims, often adults who learned Qaida and Ampara (e.g. Bangla Noorani Qaida, Nadia Ampara) as children, then drifted. They:
- forget rakʿāt structure and lose count mid-prayer;
- remember surahs and Arabic only partially;
- feel shame about missed prayers, which makes them avoid religious apps;
- pray at different mosques at different times, and forget infrequent jamaat times (Eid, Jumuʿah, Tarawih);
- live with moon-sighting uncertainty for dates.

**Tone:** mercy first, never shame. Research basis: self-compassion after a lapse increases motivation to improve (Breines & Chen, 2012, PSPB 38(9)).

## 2. Brand

- **Name:** *awwab* (أوّاب, "the one who keeps returning"). Anchors: Al-Isrāʾ 17:25, Qāf 50:32. Tagline: **"For those who keep coming back."** (Check store/domain availability before launch.)
- **Logo:** lowercase Noto Sans SemiBold wordmark with one Arabic **fatha** over the first "a". The monogram is the "a" with its fatha. Components: `Logo/Wordmark` 11:95, `Logo/Wordmark (on dark)` 14:111, `Logo/Monogram` 11:82, `Logo/Monogram (on dark)` 11:88, `Logo/AppIcon` 11:89.
- **Voice:** see Brand page (30:2) for say/never-say pairs.
- **Principles:**
  1. Every Arabic word is tappable and spells itself out.
  2. Consistency over intensity: streaks never reset to zero.
  3. Sources are always visible.
  4. Offline and private.
  5. Tonal surfaces, no outlined boxes, equal-width siblings.
  6. One component library with two theme modes.

## 3. Hard constraints

1. **No backend. Fully offline after first load.** Static files only, hosted on GitHub Pages. No accounts and no analytics.
2. **Privacy:** all user data lives in IndexedDB on the device. Backup and restore is an exported file.
3. **Location is opt-in**, only in Umrah mode and for "nearest mosque". It is never uploaded.
4. **No push server.** Reminders are delivered by **.ics export** to the device calendar (works offline). In-app prompts show while the app is open.
5. **No network-dependent AI or ASR.** "Record & compare" is local MediaRecorder playback beside the reciter audio.
6. Sharing (WhatsApp, hotel pin) uses the Web Share API or `wa.me` deep links. These are optional and need the network.

## 4. Modes & surfaces

| Mode | What changes | How |
|---|---|---|
| **Adult** (default) | Calm, meaning-first copy; Noto Serif headings | `data-mode="adult"` |
| **Maktab (age 12)** | Brighter palette, Baloo 2 + Nunito, simpler copy, stickers, shorter lessons (≤3 min), Ampara-style spelling on by default | `data-mode="maktab"` + copy variants (`copy.adult` / `copy.maktab`) |
| **Umrah mode** | Separate tab bar (Now · Rituals · Map · Duʿās · Plan), Makkah time, context engine, optional location | route group `/umrah/*`, toggled from Plan |
| **Desktop** (≥1024px) | **Learning-first**: opens on Study plan; sidebar replaces the tab bar (Adult: dense dashboards; Maktab: simple); Word anatomy becomes a persistent side panel | CSS breakpoints; `Desktop/Sidebar (Adult · dense)` 40:1410, `Desktop/Sidebar` 24:128 (Maktab) |
| **Print** | A4 printables generated from user data | `@media print` routes `/print/*` |

Arabic font for **all learning and UI Arabic** is Noto Sans Arabic in both modes, so letter shapes never change between modes. The Quran reading view uses a mushaf font chosen by the **script setting** (IndoPak, like the Bangla Ampara, or Uthmani).

## 5. Screens (Figma node IDs)

**Foundations** (page 5:3):
- TabBar 7:165 (Today · Learn · Return · **Plan** · You)
- Button 7:177, Chip 7:189, Badge 8:222, ProgressBar 8:224, SectionHeader 8:227, NavHeader 8:231, ListRow 8:240
- PrayerRow 8:294 (Done/Late/Missed/Next/Upcoming)
- **LetterTile 13:141**, **WordChip 13:155** (Default/Selected/Hint/Hidden)
- Icons 8:69–8:213

**Adult screens** (page 5:4):

| ID | Screen | Node |
|---|---|---|
| A01 | Welcome | 12:123 |
| A02 | Choose how you learn (Adult/Maktab + script) | 12:150 |
| A03 | Recall check (placement) | 12:216 |
| A04 | Today | 10:2 |
| A05 | How to pray (per prayer, rakʿah by rakʿah, sahw) | 18:268 |
| A06 | Return (tawbah): istighfar counter, Sayyid al-Istighfār, 4 steps, hope | 18:340 |
| A07 | Make-up prayers (qaḍāʾ) & fasts | 18:501 |
| A08 | Learn hub | 19:442 |
| A09 | Qaida lesson (Harakat) | 19:596 |
| A10 | Surah recall (Al-ʿAsr) | 16:165 |
| A11 | **Word anatomy** sheet | 16:274 |
| A12 | Takhti (writing) | 19:745 |
| A13 | Understand your salah (word-by-word) | 19:852 |
| A14 | Fluency (Quran ↔ modern Arabic) | 19:962 |
| A15 | Hadith (popular & authentic) | 21:722 |
| A16 | Plan → Calendar (moon-aware) | 23:1013 |
| A16b | Event sheet: Eid (flexible date, confirm, where you'll pray) | 23:1314 |
| A16c | My mosques | 23:1397 |
| A17 | Zakat | 21:1081 |
| A18 | Umrah guide | 21:1175 |
| A19 | You (masjid progress, settings) | 21:1326 |
| U01 | Umrah mode: Now (context-aware) | 26:1259 |
| U02 | Offline map (hotel & gate memory) | 26:1378 |
| U03 | In the Haram (focus) | 26:1476 |
| U04 | Live guide: Saʿy (location-aware) | 28:1235 |
| U05 | "Walk with me" (location opt-in) | 28:1336 |
| — | UmrahTabBar | 26:1258 |

**Maktab** (page 5:5): M04 Today 27:1233 · M09 Qaida 27:1414 · M11 Word anatomy 27:1563 · M12 Takhti 27:1742 · M06 Say sorry to Allah 27:1804 · M19 My masjid & stickers 27:1963.

**Desktop & Print** (page 23:1597). Desktop is **learning-first** in both modes.
- Adult (dense dashboards, 224px sidebar + 1216 main): **DA0 Study plan (desktop home) 58:768** · DA2 Surah study workspace 41:851 · DA3 Qaida + Takhti workspace 59:899 · DA4 Word bank & fluency 60:1031 · DA5 Prayers (secondary) 41:387.
- Maktab (simple, large type): **DM01 Learn home 63:1172** · DM02 Surah + Word anatomy 24:319 · DM03 Prayers (secondary) 24:129.
- Components: Desktop/Sidebar (Adult · dense) 40:1410 (Active = Study plan / Qaida / Surahs / Word bank / Prayers) · Desktop/TopBar 40:1411 (Title, Subtitle) · Desktop/Sidebar (simple, Maktab) 24:128.
- Print: P01 Monthly timetable 24:523 · P02 Takhti worksheet 24:864 · P03 Surah pocket cards 24:961.

**Share & growth** (page 53:30): Share/Footer 53:47 (Theme = Night/Light; props Link, Tagline) · share icon 53:29 · Stories SC1 Surah learned 53:48 · SC2 Quran words 53:86 · SC3 Coming back 54:32 · SC4 Qaida (light) 54:266 · SC5 Umrah 54:315 · SC6 Maktab, all 28 letters 54:340 · Post 4:5 SP1 54:419 · Wide 1.91:1 SW2 54:452 · A20 Share sheet 56:92 · A21 Milestone moment 56:461.

**Landing page** (page 35:12): L01 desktop 1440 35:13 · L02 mobile 390 38:1286.

**Docs:** Brand 30:2 · Cover 30:187 · Flows & Handoff 30:200.

## 6. Features & acceptance criteria

### 6.1 Today (A04)

- Prayer times are computed on the device with **adhan-js**.
  - Defaults: method Karachi, madhab Hanafi for Bangladesh (all methods are selectable).
  - Location: geolocation or manual city. Remove the IP lookup.
- Prayer states: `upcoming | now | done | late | missed`. *Prayed* and *time passed* are separate concepts (the current code conflates them).
  - **Missed** offers "Make up now" (logs a qaḍāʾ) and kind copy. Never use "failed" or "broke".
- Hero card ("now" prayer):
  - Time left
  - Rakʿāt structure as **equal-width** cards
  - **Jamaat time from My mosques** for the mosque mapped to this prayer and day
  - "I've prayed" and "How to pray" buttons (equal widths)
- "Your 5 minutes": the due SRS item, the next Qaida micro-lesson, and istighfar progress.
- Hadith of the day comes from the curated set. "Coming up" shows events as chips with ranges ("Rajab · Thu 10 or Fri 11 Dec").

### 6.2 How to pray (A05)

- Data comes from `docs/content/rakat-structure.json`. Madhab is configurable.
- Shows the 4 Fard rakʿah by rakʿah: what to recite, the sittings, and suggested short surahs from the user's *solid* list.
- **Lost count:** build on certainty, then two prostrations before salām (Sahih Muslim 571). Include a madhab note.
- Buttons: "Practice with audio" (offline pack) and "Word by word" (links to A13).

### 6.3 Return (A06) & Qaḍāʾ (A07)

- **Istighfar counter:** a tap target with a progress ring, daily goal 100 (Muslim 2702), and haptics. The Arabic text is rendered with WordChips.
- **Sayyid al-Istighfār** (Bukhari 6306) is taught line by line as a 7-line learning path.
- 4 steps of a sincere return: stop, regret, resolve, repair. Hope card: Az-Zumar 39:53.
- **Qaḍāʾ:**
  - Estimator: years × 5 minus prayers actually prayed.
  - Per-prayer counters with a +1 button; daily goal chips; projected finish date; missed fasts.
  - Note that scholars differ.
- **Consistency model:** there are no zero-resets.
  - Masjid stage = rolling 30-day consistency %.
  - Missed days "dim the lamps" (visual).
  - **"Returns"** counts how many times the user came back after missing a day, and is celebrated.

### 6.4 Learn

**Word anatomy engine (core, used everywhere)**

Any Arabic string in the app renders as a row of `WordChip`s (RTL; use explicit line breaks, never flex-wrap). Tapping one opens A11, or the desktop side panel. Example output: `docs/content/word-anatomy.sample.json`.

The sheet has these sections:
1. **Letters, right to left:** a LetterTile per letter showing glyph (tinted by haraka), letter name, mark name, and sound. Alif waṣl is shown as a silent tile.
2. **Sounds:** syllables joined into the word.
3. **Joining:** start, middle and end forms. Non-joining letters are ا د ذ ر ز و.
4. **Root and family:** from Quranic Arabic Corpus morphology. Check the licence; it is GPL.
5. **Quran ↔ modern:** the modern (imlāʾī) spelling plus 2–3 curated Modern Standard Arabic examples.

Settings:
- Spelling style: English ("Bāʾ + fatha = ba") or **Bangla Ampara style** ("বা যবর বা"). The Maktab default is Ampara style.
- Tile colours are colour-blind safe and never colour-only: the mark name is always shown.

Unit tests: grapheme splitting with Quranic marks (U+06E1, U+0670, U+0671, U+06DF…), silent waṣl, syllabification, joining forms.

**Qaida (A09)**
- 17 lessons in Noorani order (`qaida-lessons.json`; verify against the user's Bangla edition).
- 3–5 minute sessions.
- Activities: hear → read along → identify (quiz with equal-width options) → **Record & compare** → "Spot it in the Quran".
- A03 places the user by asking "Can you read this?" on letters, harakat, words and an āyah.

**Surahs for salah (A08, A10)**
- Order comes from `surahs-for-salah.json`: Al-Fātiḥa, then shortest by word count (Al-Kawthar 10, Al-ʿAsr 14, Al-Ikhlāṣ 15, Quraysh 17, An-Naṣr 19, An-Nās 20 …).
- Modes: Listen / Read / Recall. Recall uses first-letter hints, then hidden words, with English cues.
- **SRS:** FSRS or SM-2 lite. Grades: Forgot / Shaky / Got it. These map to maktab buckets:
  - **Sabaq** (new)
  - **Sabqi** (recent, under 7 days)
  - **Manzil** (stable)
- Each surah suggests "Use it in tonight's Maghrib, rakʿah 2."

**Takhti (A12)**
- Canvas tracing (Pointer Events) with stroke-order hints and start dots.
- "Wash the takhti" clears the board.
- Letters are taught by **shape family** (`arabic-letters.json` → `family`), then joined words.
- Stroke-order data is hand-authored per letter. Start with the 9 families.

**Understand your salah (A13)**
- Word-by-word glosses for Al-Fātiḥa, the adhkār of each position, Tashahhud and Ṣalawāt.
- Tracks the "core 125 words": the Understand Quran Academy approach, where ~125 words cover about half of Quran word occurrences.

**Fluency (A14)**
- Root of the day.
- "Same word, two worlds": Quranic ↔ modern pairs (e.g. يوم: Day of Judgement ↔ اليوم "today").
- Reading without harakat: signs and headlines.
- Curated content is bundled.

**Hadith (A15)**
- Only ṣaḥīḥ or ḥasan narrations, always showing collection, number and grade.
- Bundled from `fawazahmed0/hadith-api` (Unlicense) at build time; seed in `hadith-curated.json`.
- "Search offline" searches the bundled corpus. If a narration isn't found, the app says it cannot verify it.

### 6.5 Plan (renamed from Calendar)

**Calendar (A16, A16b)**
- Hijri dates come from `Intl.DateTimeFormat('en-u-ca-islamic-umalqura')` plus a global adjustment (−2…+2).
- Events come from `islamic-events.json`:
  - Moon-dependent events stay **Expected** and show **both** possible dates until confirmed.
  - Confirmation records a source: national committee / Saudi / my mosque / family.
  - Confirming a month start **re-anchors** that month, and every later date and reminder shifts.
  - Per-event ±1 adjustment.
- **Moon-watch prompt** on the 29th after Maghrib: "Was the moon seen?" → starts tomorrow / completes 30.
- Every change re-exports the .ics file.

**My mosques (A16c)**

Data model:
```ts
Mosque {
  id; name; role: 'home' | 'office' | 'jumuah' | 'eid' | 'hometown' | 'other';
  location?;
  jamaat: { fajr?, dhuhr?, asr?, maghrib?: 'adhan+5' | time, isha?, jumuah?: { khutbah, prayer } };
  occasional: [{ type: 'eid_fitr' | 'eid_adha' | 'tarawih', times[], year }];
  source: 'board_photo' | 'imam' | 'friend' | 'visited';
  updatedAt; photo?: Blob;
}
```
- **Weekly mapping** (prayer × weekday → mosque), e.g. Sun–Thu Dhuhr/Asr at the office; Fri–Sat at home.
- Stale nudges: when a timetable usually changes (seasonal), when the date is older than N months, and before Ramadan/Eid.
- **Eid by location:** "Where will you pray?" (home city / hometown) shows jamaat lists and last year's record.
- "Ask on WhatsApp" pre-fills a message.

**Zakat (A17)**
- Zakat date (hawl) in Hijri.
- Nisab: **silver 595 g** (default, recommended by many Hanafi scholars) or **gold 85 g**.
- Units include **bhori/tola = 11.664 g** (nisab ≈ 51 bhori silver / ≈ 7.3 bhori gold).
- Assets minus debts due, at 2.5%.
- Metal prices are **entered manually** (no API). Notes cover the scholarly difference on worn jewellery. "This is a calculator, not a fatwa."
- Log payments.

**Umrah guide (A18):** the visual ṭawāf diagram, round counter and 7 steps (`umrah-steps.json`).

### 6.6 Umrah mode (U01–U05)

- **Activation:** Plan → Umrah → set trip dates, hotel and group, then optionally **"Walk with me"** (U05: location, auto saʿy laps (beta), voice guidance, hotel and gate memory).
- **Context engine** (on-device rules, no AI):
  - Inputs: Makkah time, the next prayer (adhan-js with the Umm al-Qura method and Makkah coordinates), the user's state chip ("At the hotel / Walking / In the Haram / Doing Umrah / Resting / Eating out"), auto-detected by geofence when location is on, and the trip plan.
  - Output: a "Next" card ("Leave by 4:55") plus today's timeline. Example rules:
    - leave time = adhan − walk time − crowd buffer (15–25 min, larger on Fridays);
    - after Fajr → Ḍuḥā suggestion after sunrise;
    - midday heat → hydration;
    - night → Tahajjud alarm (.ics).
- **Consistency across the trip:** prayers in the Haram, juz progress, **duʿā requests list** (people who asked you to pray for them, ticked off).
- **In-Haram focus (U03):**
  - iqāmah countdown (approximate, configurable offsets);
  - dhikr counter, continue Quran, voluntary ṭawāf;
  - remembers the entry gate.
- **Live guide (U04):**
  - The step advances on geofence entry.
  - **Saʿy auto-laps** come from alternating Ṣafā/Marwah geofence entries with hysteresis, and can be corrected.
  - The guide shows seven alternating lap directions, lets you pause or correct the saved count, and uses recent, precise fixes near the OpenStreetMap endpoints for the live position and approximate distance.
  - Ṭawāf stays manual: GPS is unreliable near the Kaʿbah.
  - Optional voice uses a downloadable offline pack with generated narration for all seven steps. English and Bangla editions show their spoken text and voice credits. Personal recordings can still be imported per step.
- **Offline map (U02):**
  - **MapLibre GL JS + PMTiles** extract of Makkah and Madinah (OpenStreetMap, ODbL attribution), downloaded as a pack and cached by the service worker.
  - Pins: gates (numbers and names from OSM), Ṣafā/Marwah, Zamzam, wudu areas, Clock Tower, **hotel**, **meeting point**.
  - "Back to hotel": haversine distance, bearing and DeviceOrientation compass. Works with no network.
  - The figure in Figma is schematic. **Never hand-place coordinates**; trace them from OSM.

### 6.7 You (A19)

- Masjid illustration stages (foundation → walls → dome → minarets → complete) driven by 30-day consistency.
- Stats tiles (equal widths); 30-day heat strip.
- Settings: mode, script, madhab and method, Hijri adjustment, reminders (.ics), backup and export, language (EN now; বাংলা next, Noto Sans Bengali).

### 6.8 Desktop: learning first (DA0–DA5, DM01–DM03)

On a laptop awwab is a **study desk**. Prayer tracking is still there, but it's secondary: a "Daily" group in the sidebar and a small next-prayer chip in the top bar.

- **Routing at ≥1024px:** `/app/` opens **Study plan** (DA0 in Adult, DM01 in Maktab). Phones keep Today as the home tab.
- **Adult shell (dense):** 224px sidebar with offline search (Ctrl K), groups **LEARN** (Study plan · Qaida · Surahs · Word bank · Takhti · Fluency · Hadith), **DAILY** (Prayers · Return · Plan), **TOOLS** (My mosques · Zakat · Umrah mode · Print & export), counts on every item. 64px top bar: title + Gregorian/Hijri date, next-prayer chip, **Start review** (primary), Log prayer, Share, notifications.
- **Density:** body 13/18, small 12/16, caption 10; widget cards 16px padding, header row (title + action link); zebra tables via tonal row fills (no borders); widgets in a row share height; 4-column grid (280px + 16px gaps) so rows line up.
- **DA0 Study plan:** Continue card (resume exact lesson/row) · study streak (pauses, never resets) · due-for-review counts by Sabaq/Sabqi/Manzil · Today's plan table (type, item, method, est. minutes, Start) · Quran words (known / 125) · Reviews ahead (7-day forecast + first-try recall %) · Noorani Qaida path (17 nodes) · Surahs for salah · Takhti letter families.
- **DA2 Surah study:** due queue + shortest-first list + review buckets | reader with Listen/Read/Recall, word-by-word chips, per-āyah play/loop/record, grading Forgot/Shaky/Got it | persistent **Word anatomy** panel (letters, sounds, joining, prefixes, root family, Quran vs modern, modern example sentences).
- **DA3 Qaida + Takhti:** 17-lesson list | Qaida-page drill grid (rows of letters × harakat, colour-coded, transliteration, current row highlighted), Ampara spelling (Rāʾ + pesh = ru, Bangla রা পেশ রু, Iqra direct-read), Hear row / Record & compare / Hard·Okay·Easy | Takhti tracing canvas (baseline guides, start dot, stroke path, numbered steps, letter forms, Clear / Show me / Compare, print sheet). Pointer Events: mouse, trackpad, touch and stylus (pressure ignored).
- **DA4 Word bank & fluency:** KPI strip · filterable table (word, transliteration, meaning, root, type, frequency bar, status, next review) · Root explorer (Quran and modern family) · "Read it in modern Arabic" (unvowelled sentence, known/learning/new chips).
- **DA5 Prayers:** the dense prayer dashboard (timeline, prayers table with jamaat and mosque, 7-day grid, qaḍāʾ balance), reached from DAILY.
- **Maktab desktop (DM01–DM03):** keeps the simple 248px sidebar with **Learn first**, big type, one primary action per card: Today's lesson, stickers, letter of the day, surah practice, words I know, Qaida path. Prayers (DM03) is secondary.

### 6.9 Print (P01–P03)

`/print/timetable`, `/print/ramadan`, `/print/takhti/:family`, `/print/surah-cards`, `/print/umrah-guide`, `/print/qada-sheet`, `/print/zakat-summary`.

- A4, `@page { size: A4; margin: 12mm }`, white background, zebra rows (no borders), the user's jamaat times in the footer.
- Moon-dependent Hijri dates are marked with `*`.

### 6.10 Landing page (L01, L02)

**Routes** (paths below are relative to the Pages base `/awwab/`)
- `/` is the English marketing landing page. Vite prerenders it and each published locale at `/lang/<locale>.html`. A small standalone script switches languages in place.
- `/app/` is the PWA.
- The app service worker stays scoped to `/app/`. A separate landing worker caches the marketing pages and their assets for offline visits and language switching. The "Open awwab" CTA goes to `/app/`. "Install the app" triggers `beforeinstallprompt` where supported and otherwise shows per-platform instructions.

**Sections, in order**
1. Nav
2. Hero: headline, subhead, CTAs, trust row ("No account · Works fully offline · Nothing leaves your phone · Install on any phone or computer"), two phone shots
3. Verse band (17:25)
4. "Built for the way you actually pray": 3 equal cards
5. Feature rows, alternating sides: Today · Return · Word anatomy (live LetterTile row) · Learn · Plan
6. **Umrah mode showcase** (dark band): three devices (offline map · Now · live saʿy guide), six feature cards, checklist strip
7. Two modes: cards rendered in each theme
8. **Share your progress**: three story cards + four points (sizes, on-device, link inside, prayer numbers hidden)
9. Phone · laptop · paper: the learning dashboard (DA0) in a laptop frame plus print thumbnails
10. Offline & private: 4 equal tiles plus a "Sources you can check" card
11. FAQ: 2×3 grid on desktop, accordion on mobile
12. Final CTA, then a separate footer (divider, 120px gap): wordmark + links to Features, Privacy, Sources & licences, GitHub; disclaimer "a learning and tracking aid, not a source of religious rulings"; credit **"Designed and built by tanziro.com"** linking to https://tanziro.com

**Implementation notes**
- Device frames: thin dark bezel, concentric corners (screen 26 / device 33 on desktop; 22 / 28 on mobile), effect style `Elevation/Device`. Shots are never cropped by a section edge; leave ≥72px below.
- Phone and desktop shots are **real app screenshots**, exported from Figma or captured from the built app at 2× as WebP with `srcset`. Never hand-mock them.
- Build at ≥1024px as L01 and below that as L02, stacking in the same order.
- Add Open Graph and Twitter meta tags, using the Cover frame 30:187 as the OG image.
- Add JSON-LD `WebApplication` structured data.
- Lighthouse targets: Performance ≥95 and Accessibility 100 on the landing page.
- Copy must not over-claim. Only say "reviewed by scholars" once that review has actually happened (SPEC §12).

### 6.11 Share & growth (SC1–SC6, SP1, SW2, A20, A21)

Sharing progress is a growth loop: every image carries the brand and the link. **No QR codes.**

- **Templates:** Surah learned · Quran words · Coming back (returns + year heatmap, no numbers) · Qaida lesson (light) · Umrah day ("Remember us in your duʿā") · Maktab milestones. More later: Ramadan recap, Takhti, hadith of the week.
- **Formats:** Story 9:16 (1080×1920), Post 4:5 (1080×1350), Wide 1.91:1 (1200×630). Designed at 360-wide in Figma; export at 3× / 2×.
- **Brand footer (Share/Footer):** wordmark + tagline + **link text**. The link is one config value: `SHARE_URL = https://tanzir71.github.io/awwab/` (the GitHub Pages address of the repo, renamed from `prayer-quest` to `awwab`). Images print it without `https://`. If a custom domain is added later, change only this value.
- **Entry points:** milestone moments (A21: surah moves to Manzil, Qaida lesson done, word milestones 25/50/100/125, Maktab book complete), Desktop TopBar "Share", Return and You screens ("Share progress"), Umrah mode (Umrah card).
- **Share sheet (A20):** template carousel, format toggle, "Show prayer numbers" **off by default** ("Share to encourage, not to compare"), light/dark background, **Share…** and **Save image**.
- **Offline rendering:** draw the card from the same React component into a canvas on the device (e.g. `html-to-image` with fonts embedded from the bundled Noto subsets, or direct Canvas 2D). Never upload. Wait for `document.fonts.ready` before rendering; Arabic must be shaped correctly (test on iOS Safari and Android Chrome).
- **Sharing:** Web Share API Level 2: `navigator.canShare({ files })` → `navigator.share({ files: [png], text, url })` where `text` is a short line ("I learned Al-ʿAsr with awwab") and `url` is `SHARE_URL + '?ref=share-' + template`. Fallback: download the PNG and copy the text + link to the clipboard. Desktop: Save image + Copy link.
- **Privacy & adab:** no names unless the user adds one; prayer counts hidden by default; no location in images; nothing leaves the device until the user taps Share.

## 7. Data sources & licences (bundle at build time)

| Data | Source | Licence / note |
|---|---|---|
| Prayer times | adhan-js | MIT |
| Hijri | `Intl` islamic-umalqura + user adjustment | built-in |
| Quran Uthmani text | Tanzil.net or QUL (Quran Foundation) | Tanzil: verbatim, attribution |
| Quran IndoPak text | QUL / Quran.com `text_indopak` | check terms |
| English translation | Saheeh International (as in the designs) | **copyrighted, get permission** or choose an openly licensed translation |
| Word-by-word glosses | QUL word-by-word | check terms |
| Roots / morphology | Quranic Arabic Corpus | GPL, check compatibility |
| Hadith | fawazahmed0/hadith-api | Unlicense |
| Audio | per-āyah MP3 (e.g. everyayah.com) as optional packs | verify reciter permissions |
| Maps | OpenStreetMap → Protomaps PMTiles extract | ODbL attribution |
| Fonts | Noto Sans / Serif / Sans Arabic / Sans Bengali, Baloo 2, Nunito | OFL |

Build script `scripts/build-content.ts` fetches sources and emits versioned JSON into `public/data/`. Packs over a few MB are lazy and opt-in.

## 8. Architecture

- Keep **Vite + React 18 + TS + Tailwind + shadcn/ui**.
- Add: `vite-plugin-pwa` (Workbox precache + runtime cache for packs), `dexie` (IndexedDB), `zustand`, `adhan`, `maplibre-gl` + `pmtiles` (Umrah pack only, lazy), `ts-fsrs` (or a small SM-2).
- **GitHub Pages:** the repo is **`tanzir71/awwab`** (renamed from `prayer-quest`), so the site lives at `https://tanzir71.github.io/awwab/`. Set Vite `base` to `/awwab/`; the landing page is `/awwab/` and the PWA `/awwab/app/` (service-worker scope `/awwab/app/`), use `HashRouter` or a 404.html SPA fallback, and make `manifest.start_url` and `scope` relative. A GitHub Actions deploy workflow is needed.
- **Tokens:** `docs/design-tokens.json` → CSS variables on `:root[data-mode=adult|maktab]` → Tailwind theme. Shadows map from the `shadow` tokens. **Never add borders to containers.**
- **RTL:** wrap Arabic in `<span dir="rtl" lang="ar">`. `WordChip` rows use `flex-direction: row-reverse`, or `direction: rtl` with explicit lines; test with Quranic marks.
- **i18n:** an ICU message catalogue with copy variants per mode.
- **Accessibility:** WCAG AA contrast in both modes, 44px targets, reduced motion, screen-reader labels for Arabic (with transliteration).

## 9. Data model (sketch)

```ts
PrayerLog { date: 'YYYY-MM-DD', prayer, status: 'done' | 'late' | 'missed' | 'qada', at?, mosqueId? }
QadaBalance { prayer, remaining, madeUp }
ReviewCard { id, kind: 'surah' | 'ayah' | 'word' | 'letter', ref, fsrs: {...}, bucket: 'sabaq' | 'sabqi' | 'manzil' }
EventOverride { eventId, hijriYear, confirmedDate?, source?, adjust: -1 | 0 | 1 }
Mosque { ... (see 6.5) }
ZakatProfile { hawlHijri, nisabBasis: 'silver' | 'gold', assets[], debts[], payments[] }
UmrahTrip { start, end, hotel: { name, lat, lon, room? }, meetingPoint?, entryGate?, duaRequests: [{ name, for, done[] }], laps }
Settings { mode, script, madhab, method, hijriAdjust, spellStyle: 'en' | 'ampara-bn', language }
```

## 10. Build phases (each ends deployable)

1. **P0 Foundation.**
   - Rebrand (name, icons, manifest); tokens and modes; app shell (tabs and sidebar); PWA offline; adhan-js.
   - Fix GitHub Pages base, start_url and router.
   - **Fix known bugs (§11).**
2. **P1 Prayer.** Today, How to pray, Return, Qaḍāʾ, consistency model (no reset), .ics reminders, backup/export.
3. **P2 Arabic core.** WordChip + Word anatomy engine (with tests), Qaida lessons 1–6, Recall check, Surahs for salah (12) with SRS, Understand salah, **Study plan (DA0/DM01) and share cards + milestone moments (§6.11)**.
4. **P3 Plan.** Moon-aware calendar, event confirmations and shifting, My mosques, Zakat, prints P01 and the Ramadan timetable.
5. **P4 Depth.** Qaida 7–17, Takhti, Fluency, Hadith, Maktab copy and stickers, prints P02 and P03.
6. **P5 Umrah mode.** Context engine, offline map pack, live guide, duʿā requests, Umrah print guide.
7. **P6 Desktop learning workspace & Bangla.** DA2–DA4 workspaces, DA5. Landing page (L01, L02) with real screenshots, OG image and launch.

## 11. Known issues in the current code (fix in P0)

- `prayerServices.ts`: `isCompleted = isCompletedToday || currentTime > prayerDateTime` marks passed prayers as completed. Separate the *passed* and *prayed* states.
- Rakʿāt data:
  - Dhuhr order should be 4S → 4F → **2S → 2N** (the code puts Nafl before Sunnah).
  - Isha is missing the **2 Sunnah muʾakkadah** after Fard.
  - See `rakat-structure.json` (Hanafi; review with a scholar).
- Network dependence: Aladhan API and the `ipapi.co` IP lookup must go. Replace them with adhan-js and manual location.
- `manifest.json`: `start_url: "/"`, white theme, old name. These break on a GitHub Pages subpath.
- `MosqueProgress`: "Miss a day and you'll need to start rebuilding!" contradicts the no-shame principle. Use the consistency model instead.

## 12. Religious content review (before launch)

Have a qualified scholar review:
- rakʿāt structures;
- sahw guidance;
- qaḍāʾ guidance and madhab notes;
- zakat notes;
- Umrah steps and duʿās;
- all hadith gradings shown;
- curated "modern Arabic" examples;
- Bangla letter and haraka names.

Show "scholars differ" wherever applicable.
