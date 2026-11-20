# 01 · Language switching

Switch every English string in the app (and the landing page) to the languages spoken by Muslims in countries that don't speak Arabic. Arabic learning content stays Arabic; only the language *around* it changes.

Figma: A26 Language [78:12](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=78-12) · A27 Your words [78:117](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=78-117) · Today in বাংলা [74:148](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=74-148) · Today in اردو (RTL) [74:505](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=74-505) · Today in Bahasa Indonesia [74:862](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=74-862) · share cards in Bangla [78:201](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=78-201) and Indonesian [78:242](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=78-242) · desktop settings DC09 [89:2511](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=89-2511).

## 1. Languages
Full list with scripts, fonts, digits, countries and suggested prayer defaults: [`data/locales.json`](data/locales.json) (34 locales).

| Tier | Ships | Locales |
|---|---|---|
| 1 | H2.2 | বাংলা bn · اردو ur · Bahasa Indonesia id · Türkçe tr · فارسی fa (incl. Dari) · Bahasa Melayu ms · Hausa ha · Français fr |
| 2 | H2.6 | پښتو ps · Oʻzbekcha uz · Kiswahili sw · Soomaali so · Azərbaycanca az · Қазақша kk · Русский ru · हिन्दी hi · Shqip sq · Bosanski bs · Kurdî ku · کوردی ckb |
| 3 | as reviewers allow | Tajik, Kyrgyz, Turkmen, Sindhi, Punjabi (Shahmukhi), Dhivehi, Wolof, Fulfulde, Yoruba, Malayalam, Tamil, Oromo, Amharic, Uyghur |

Tier 1 covers the largest non-Arab Muslim populations (Indonesia, Pakistan, India, Bangladesh, Nigeria, Iran, Turkey) and French covers most of West and North Africa.

## 2. Experience
- **Where:** onboarding step 1 (DC01/A01), Settings → Language & words (A26 / DC09), the sidebar language chip on desktop, and the landing-page nav.
- **Picker (A26):** suggested language from `navigator.languages`; search; each row shows the name **in its own script and font**, the English name, an RTL tag where relevant, and download state/size. Choosing a language downloads its pack once (catalog + font subset + translations), then it works offline.
- **Your words (A27):** Muslims say the same thing differently (namaz / salat / sholat / solat / sallah). Catalog strings reference terms (`{term_salah}`), and the user picks the option that sounds right. Terms and options are in [`data/glossary.json`](data/glossary.json).
- **Reading help:** "Quran meanings in the app language" (on), "Show English under each line" (off; useful while a translation is in review), native digits toggle (e.g. Bangla ১২৩).
- **Spelling style** stays separate: Ampara (বা যবর বা) or English (Bāʾ + fatha = ba). Later locales can add their own (e.g. Urdu: “ب زبر بَ”).
- **Share cards** use the app language for titles, captions, numbers and the footer tagline. Export uses the same type and layout as the preview. The link stays fixed. Surah cards use the installed Quran edition for the selected card language when available. The quote identifies its āyah range, translator and language. Pickthall’s English meaning remains the fallback.

## 3. Architecture (offline, no backend)
- **Library:** FormatJS (`react-intl`) with ICU MessageFormat. Source catalog `src/i18n/en.json`; compiled per locale to `public/locales/<code>.json`. No string concatenation; plurals, gender and selects in ICU.
- **Loading:** active locale is precached on selection (Workbox runtime cache `locales`); fallback chain `fa-AF → fa → en`. Switching is instant, no reload.
- **Formatting:** `Intl.NumberFormat` (digits per user choice), `Intl.DateTimeFormat` incl. `-u-ca-islamic-umalqura` for Hijri month names, `Intl.RelativeTimeFormat`, `Intl.PluralRules`. Time format per locale (Indonesian `15.36`).
  - The first value in each locale's `digits` field is its default numbering system. Reading help can switch to Latin digits when that default uses another script. Quran verse markers and gate numbers shown to others keep their Arabic-Indic digits.
- The `ui-copy/translate-visible-text` ESLint rule catches new literals in JSX text and user-facing attributes such as accessible names and placeholders. GitHub Actions runs it through `npm run lint`. `scripts/ui-copy-baseline.json` records existing literals and their counts by file. Remove those entries as the copy moves into the catalogue.
- **Pseudo-locales for QA:** `en-XA` (accented, +40% length) and `en-XB` (mirrored RTL).
- **RTL (ur, fa, ps, ckb, sd, pa-Arab, dv, ug):** `<html dir="rtl" lang>`; CSS logical properties only (`margin-inline-start`, `inset-inline-end`); Tailwind `rtl:` variants; directional icons flip via `.icon-dir`. The whole shell mirrors: sidebar on the right, tab order right-to-left, chevrons flipped, arrows in rakʿah sequences become ←.
  - Never mirror: Quran/Arabic learning components (they are already RTL), media play icons, digits, clocks.
- **Fonts per script** (subset, lazy-loaded with the pack; stack chosen with `:lang()`):
  | Script | UI font | Line height |
  |---|---|---|
  | Latin / Cyrillic | Noto Sans | 1.4 |
  | Bengali | Noto Sans Bengali (+ Noto Serif Bengali for display) | 1.5 |
  | Arabic script UI: Urdu, Persian, Pashto, Kurdish (Sorani), Sindhi, Uyghur | **Noto Sans Arabic**. Urdu users can opt into a Nastaliq reading style (Noto Nastaliq Urdu, line height 1.9) for long text only. | 1.5–1.6 |
  | Devanagari | Noto Sans Devanagari | 1.5 |
  | Thaana | Noto Sans Thaana | 1.6 |
  | Malayalam / Tamil / Ethiopic | Noto Sans Malayalam / Tamil / Ethiopic | 1.5 |
  Urdu decision: Nastaliq was hard to read at UI sizes in testing, so the UI uses Noto Sans Arabic (see A04-ur).
- **Per-locale prayer defaults** are *suggestions* in onboarding step 4 (`suggestedPrayerDefaults` in `locales.json`), never forced. Persian (Iran) and Azerbaijani have Shia majorities: Jaʿfari fiqh (method Tehran, combined prayers, different adhan wording) is a **content scope decision** for the product owner and needs scholar input before fa/az ship as more than UI translations.
  - The Prayer times step on phone and desktop shows the suggestion when Awwab supports both the calculation method and Asr option. Applying it updates the form. Saving commits the selected settings to the device.

## 4. Translated religious content (licences must be checked before bundling)
| Content | Candidate sources (verify redistribution rights for an offline app) |
|---|---|
| Quran meanings | Tanzil and QUL translation lists. Candidates: bn Muhiuddin Khan / Zohurul Hoque · ur Fateh Muhammad Jalandhry / Muhammad Junagarhi · id Kementerian Agama · tr Diyanet · fa Fooladvand / Ansarian · ms Abdullah Basmeih · ha Abubakar Gumi · fr Muhammad Hamidullah |
| Hadith | `fawazahmed0/hadith-api` editions (bn, ur, id, tr, fr, ru, ta… vary by collection) |
| Word-by-word glosses | QUL word-by-word (check which languages exist) |
| Duʿā & adhkār, How to pray, app copy | Written per locale by native reviewers |

Show the translation's name and source under every translated āyah (principle: sources visible).

## 5. Translation workflow
1. String freeze per phase; keys + English + context notes + screenshots (Playwright per screen) go to reviewers.
2. Machine draft allowed for speed but **never shipped unreviewed**; drafts are flagged in the catalog (`"_status":"draft"`).
3. Two native reviewers per tier-1 locale; religious terms checked by a local imam/teacher.
4. In-app "Suggest a better wording" (long-press) stores suggestions on the device and exports them as a file. No backend.
5. The figures in Figma are layout tests with draft translations (label on the page says so).

Generate the Tier 1 UI review files with `node scripts/export-locale-review.mjs <review-directory>`. The export includes the English ICU messages, Adult and Maktab variants, source locations, references in the app, and an index of available screenshots. Every locale file is marked as a draft. Use the English source fingerprint to match translations to the same set of messages. Choose a fresh directory for each export to preserve work in earlier drafts.

Keep the glossary arguments already present in source messages, and use the export’s `glossary` entries to add other terms to app copy where they fit. Use each as a plain ICU argument, such as `{term_wudu}`. The app fills it with the user's saved choice or the glossary default. The fingerprint includes the options in `data/glossary.json` so a change to the glossary requires a new review export.

The export includes curated word meanings for Al-Fātiḥa, Al-ʿAsr, and Salah practice, plus the translations and definitions used in the Word Anatomy example. Each gloss belongs to its source word or example. The app uses the sourced English wording until a reviewed locale supplies that key. Full word-by-word coverage still requires a reviewed, redistributable source.

The Bangla export fills the remaining study glosses from `drafts/bn.json`. Reviewers can find the new entries under `supplementalDraftKeys`. Each entry is paired with its English source so the export can omit it when that source changes.

The Urdu draft starts with the landing page, onboarding, the language picker, and Today, including the shared navigation and prayer setup. Review these on a phone and desktop in the right-to-left layout. Check the prayer labels, date and time order, and the wording in both Adult and Maktab modes.

The Urdu prayer draft also covers How to Pray, Return, the seven Sayyid al-Istighfār lines, and the make-up prayer and fasting planner. Compare the lost-count and Hanafi notes with their linked references, and check the direction of the prayer tabs, numbers, and counters.

The Urdu planning draft covers Hijri calendar and moon-sighting controls, reminder files, mosque timetables and weekly assignments, and the zakat calculator and related print sheets. Review the terms for jamaat, nisab, tola, and hawl in context. Verify the dates and labels in the calendar export after confirming a sighting.

The Indonesian draft covers all 4,005 messages in the current UI catalogue, including landing, onboarding, and the Adult and Maktab variants. The review export pairs them with the English source and links to screenshots for context. Publication requires two native reviewer sign-offs.

The Indonesian draft also covers How to Pray, Return, and the make-up prayer and fasting planner. The locale export includes the existing Sayyid al-Istighfār meanings, the hope verse meaning, and the Hanafi note on sujūd al-sahw. Review these against the linked source content. The reader displays the citations alongside whichever language is available.

The Indonesian calendar draft covers the phone and desktop views, moon-sighting confirmations, Hijri settings, and the prayer and event reminders written to calendar files. Review the event descriptions in both the calendar and the exported reminders.

The Indonesian draft also covers My Mosques, the zakat calculator, and the printed prayer timetable and zakat summary. Review the mosque timetable and assignment wording, then check how the calculator describes nisab, haul, and the differences among scholars on jewellery.

The Indonesian Qaida and Takhti draft covers all 17 lesson titles, practice and recording controls, and all nine letter-family labels in the workspace and on print sheets. Review the reading terms alongside the Arabic examples and the listening controls.

The Indonesian learning paths draft covers the path hub, placement prompts, Maktab map, and memorisation plans and reviews. The Indonesian and Bangla exports include the eight cited notes shown on memorisation passage pages. Review each note against the linked handover source and the displayed hadith reference and grade.

The Indonesian reading draft covers Fluent Reading, Read with Meaning, Recite with a Teacher, Tajweed Essentials, and Tajweed in Depth. It includes the 125 core-word glosses. Review the tajwid explanations with their cited examples and recording credits, and check the glosses in the context of each āyah.

The Indonesian Speak draft covers the shared interface and all 81 lessons across the seven courses. The pilgrimage lessons reuse the existing Indonesian Ask in Arabic meanings where the Arabic phrases are shared. Review the translated dialogues, vocabulary, and signs alongside the recordings, including the workplace scenarios in Working in the Gulf.

The Indonesian Umrah draft covers desktop trip preparation and print, the phone itinerary and Haram focus, the seven ritual steps, and offline map controls and search terms. Review the ritual descriptions with the sources shown in the guide, and check that the trip file and saved counters work across app languages.

The Indonesian settings and sharing draft covers the profile, display and prayer preferences, glossary choices and wording suggestions, backup and restore, and source credits. Review the milestone and card text in both the preview and the saved image. Where a card includes a Quran meaning, check the translation credit and fallback language alongside the verse reference.

The Indonesian Understand draft covers all 22 grammar lessons, the word-by-word Salah guide, and the Word Anatomy example for Al-ʿAsr. It also includes the curated word glosses for Al-Fātiḥa and Al-ʿAsr. Review the grammar terms alongside each cited example and compare the prayer and verse glosses with the original Arabic in reading order.

The final Indonesian draft entries cover the study desk, Today, search, Surahs, Word Bank, Fluency, the Hadith interface, and print and audio controls. Review the Indonesian Hadith labels alongside the original reference and grade. The language catalogue and a translated Hadith edition go through separate review and licensing checks.

To review the wording in the app, export a fresh review directory and put `AWWAB_REVIEW_CATALOGUE=path/to/id.draft.json` in a local `.env.review.local` file. Run `npm run build -- --mode review` and `npm run preview -- --outDir dist-review --host 127.0.0.1`. Open `/awwab/lang/id.html` on that local server and follow the link into the app. After the service worker activates, reload offline to review the installed catalogue.

The review build checks the source fingerprint, variants, and ICU arguments. Missing entries use the usual app fallbacks. Review assets go to `dist-review` and carry preview and noindex markers. Keep the exported review file outside `public/locales`. That directory accepts compiled release packs and rejects packs made by the review build.

After native review, record the reviewers in the catalogue’s `reviewers` array and set `_status` to `reviewed`. Use `node scripts/build-locale-pack.mjs <source-ui.json> <reviewed-catalogue.json> <output-directory>` to produce the UI catalogue. The build checks the source fingerprint, message coverage, mode variants, and ICU arguments. The review file retains the reviewer names.

For a static build, set the compiler’s output directory to `public/locales`. The app installer lists the compiled files that match the current English catalogue. Selecting one in Settings or onboarding downloads it from the same origin and verifies it before saving the language preference. Installed catalogues are available offline on later visits. When a new build changes a pack, selecting that language again installs the matching revision.

To include a licensed and reviewed Quran edition, pass its JSON file as the fourth argument to `build-locale-pack.mjs`. Set `locale` to the catalogue’s locale code and `_status` to `reviewed` after sign-off. Include the translator and edition in `credit`, the edition’s HTTPS address in `source`, and the redistribution terms in `license` and `licenseUrl`. The `verses` object must contain the unchanged meaning for each of the 6,236 canonical āyah references, keyed as `surah:ayah`. The compiler checks the reference coverage and attribution fields. Each displayed meaning links to its edition, and Sources lists the redistribution terms. Without an installed local edition, readers can still use the attributed English fallback.

Run `node scripts/export-quran-review.mjs <candidate-manifest.json> <new-directory>` to prepare local review drafts from downloaded numbered text. The manifest is an array with one `locale`, relative `file`, `credit`, HTTPS `source` and HTTPS `terms` per edition. The exporter checks every `surah|ayah|meaning` record, preserves the source wording and notice, and records the exact source hash. Open the output’s `index.html` to compare each edition offline with the app’s Uthmani Arabic and attributed English. Each `edition.draft.json` starts with empty redistribution fields. The [Tanzil translation terms](https://tanzil.net/trans/) accompany its candidate editions. Confirm permission and review feedback for each edition before compiling a production pack.

Use `--quran-words <reviewed-quran-words.json>` to add a reviewed word-by-word edition with the same locale and attribution fields. Put the approved glosses in `words` as a flat object keyed by `surah:ayah:word`, using 1-based positions in the bundled Uthmani text. A reviewed subset is valid. For 37:130 and 72:16, where the scripts divide words differently, provide separately reviewed IndoPak positions in the optional `indopak` object. Other positions reuse the Uthmani keys. Verify each word against its source when editions differ in spelling or word boundaries. The compiler checks references against the bundled text, and the reader credits the installed edition beside its meanings and in Sources. QUL currently lists no copyright information for the [English](https://qul.tarteel.ai/resources/translation/92/licence), [Urdu](https://qul.tarteel.ai/resources/translation/93/licence), [Bangla](https://qul.tarteel.ai/resources/translation/94/licence) and [Indonesian](https://qul.tarteel.ai/resources/translation/96/licence) candidates. Confirm redistribution permission before publishing an edition.

To include reviewed Hadith translations, add `--hadith <reviewed-hadith-meanings.json>` to the same command. The input has `locale`, `_status`, and a `collections` object keyed by the bundled collection IDs. Each collection has `credit`, `source`, `license`, `licenseUrl`, and a `narrations` object keyed by canonical number, including its suffix when present. Each narration has `book`, `inBook`, and the unchanged translation `text`. The compiler checks all three reference fields against Awwab’s bundled narrations. Collections can contain a reviewed subset. Search includes installed translations, and the reader links each translation to its edition alongside the original reference and grade. English is available from the reader, and Sources lists the edition’s redistribution terms.

Prepare drafts with `node scripts/export-hadith-review.mjs <source-manifest.json> <draft-output.json>`. The manifest names a `locale` and has a `collections` object keyed by collection ID. Each entry has a relative `file` path to a downloaded Hadith API JSON edition and a `source` URL. Include `credit`, `license`, and `licenseUrl` when established. The draft records the source file hash, keeps the bundled Arabic and English beside each candidate, and reports mismatched and ambiguous references for review. Only unique matches on the canonical number, book and in-book number enter the draft. Confirm the translator and redistribution terms before marking an edition reviewed.

The installer also verifies and caches any script fonts needed by a published locale. Locales that share a font reuse the cached file. If part of a saved pack is missing or damaged, Awwab opens in a built-in language. Select the language again online to repair the missing files. The app includes small language-name fonts so the picker can show native names before installation, including offline. Regenerate those subsets with `python scripts/build-locale-name-fonts.py` using the pinned Fontsource packages and FontTools with Brotli support.

With a published Urdu pack selected, enable **Nastaliq for Urdu reading** under **Reading help**. The first use verifies and downloads Noto Nastaliq Urdu. The setting reuses that offline font for longer Urdu guidance in How to pray and Umrah. The font choice is included in backups.

The review export includes the landing page, navigation labels, metadata and image descriptions. Production emits an English page and an HTML alternate for each compiled locale. The nav lists those editions and switches between them without a reload. Each edition has a canonical URL and `hreflang` links. Opening Awwab from a localized edition sets the app language. The landing pages work offline after their worker finishes caching them. Preview builds include draft Bangla for layout review and carry a `noindex` directive.

## 6. Acceptance
- Every route passes `en-XA` at 360px and 1280px with no clipped text; `en-XB` and `ur` mirror correctly.
- Language switch updates text, numbers, dates, Hijri months and share cards without reload, offline after first download.
- Arabic Quran text, WordChips and LetterTiles look identical in every locale.
- Tier-1 catalogs 100% translated and reviewed; glossary defaults confirmed by reviewers.
- Landing page: language switcher in the nav, tier-1 translations, `hreflang` alternates.
