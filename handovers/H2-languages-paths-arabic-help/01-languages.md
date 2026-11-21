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

The Urdu draft covers all 4,042 messages in the current UI catalogue. Review the landing page, onboarding, language picker, Today, and prayer setup on phone and desktop in the right-to-left layout. Check the prayer labels, date and time order, and the wording in both Adult and Maktab modes. Publication requires two native reviewer sign-offs.

The Urdu prayer draft also covers How to Pray, Return, the seven Sayyid al-Istighfār lines, and the make-up prayer and fasting planner. Compare the lost-count and Hanafi notes with their linked references, and check the direction of the prayer tabs, numbers, and counters.

The Urdu planning draft covers Hijri calendar and moon-sighting controls, reminder files, mosque timetables and weekly assignments, and the zakat calculator and related print sheets. Review the terms for jamaat, nisab, tola, and hawl in context. Verify the dates and labels in the calendar export after confirming a sighting.

The Urdu settings draft includes the profile, display, reading, and privacy panels, backup and restore messages, local wording suggestions, source credits, and share controls. Review the backup replacement warning, the descriptions of on-device storage, and the distinction between the app language and the language on a share card.

The Urdu reader draft includes Hadith search and citation controls, Surah reader options, and the study glosses for Al-Fātiḥa, Al-ʿAṣr, and words said in prayer. Compare the glosses with the linked Arabic excerpts. The Hadith reader uses the attributed English edition for full narrations until a reviewed Urdu edition is available.

The Urdu learning paths draft covers the four paths, placement, the Maktab map, and memorisation plans, portions, and weekly checks. It includes the eight passage notes with their existing hadith references and grades. Review the Urdu terminology for sabaq, sabqi, and manzil throughout the plan and review screens.

The Urdu vocabulary and Qaida draft covers all 125 core Word Bank glosses, the word-type labels, related modern Arabic examples, all 17 Qaida lesson titles, and the nine Takhti letter families. Review the short glosses alongside their Arabic forms and the Quranic Arabic Corpus credit. Check the Adult and Maktab harakat explanations, the recording and playback controls, and the printed writing guides.

The Urdu Umrah draft covers trip preparation and transfer, the daily itinerary, Haram focus, the seven ritual steps and pocket guide, and the offline map controls. Check the ritual references, the distinction between a ṭawāf round and a saʿy lap, and the description of optional location use.

The Urdu Tajweed and reading draft covers both Tajweed levels, the 17 articulation points, script comparison, Quran reading progress, and the teacher checklist. Review the technical terms with the marked Arabic examples and their source references.

The Urdu grammar draft covers Grammar Foundations, Roots & Patterns, and Sentence Structure. Review the explanations, practice prompts, and the Ibn Kathīr note beside the cited Arabic. Check the use of traditional Urdu grammar terms for pronouns, derived forms, and case endings.

The Urdu Speak draft covers the variety and goal controls and all 36 A1 lessons across Saudi Hijazi, Gulf Arabic, and Modern Standard Arabic. Review the Urdu meanings beside the matching Arabic dialogue, vocabulary, and signs. The lessons share the existing generated Arabic recordings.

The Urdu draft also covers all 14 Saudi A2 and 12 Saudi B1 lessons. Review the meanings in the context of each exchange, especially the B1 reply drills, and compare the dialogue with the generated Saudi audio.

The Urdu draft includes the nine Umrah & Hajj and ten Gulf Work speaking lessons. Check the Umrah dialogue against the phrases it shares with Ask in Arabic, and review the workplace vocabulary for shift schedules, safety, contracts, and pay.

The final Urdu entries cover the study desk, milestone and share cards, audio pack prompts, surah pocket cards, and startup and storage messages. Review the wording on both the share preview and exported image.

The Indonesian draft covers all 4,042 messages in the current UI catalogue, including landing, onboarding, and the Adult and Maktab variants. The review export pairs them with the English source and links to screenshots for context. Publication requires two native reviewer sign-offs.

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

The Turkish draft covers all 4,042 messages in the current UI catalogue. Review the landing page, onboarding, placement, prayer setup, and Today in Adult and Maktab modes. Check the prayer method and school labels alongside the suggestions, and review the Qur’an terminology with the placement and Elifba lesson examples.

The Turkish settings draft includes reading and display preferences, your words, backup and restore, reminders, and source credits. Review the calendar file labels and the backup and glossary controls alongside the screens that use those preferences.

The Turkish planning draft covers the Hijri calendar and local moon-sighting confirmation, as well as mosque timetables, source labels, weekly assignments, and Eid records. Review the expected and confirmed dates in the calendar and the exported reminders. Check the WhatsApp wording with actual mosque names.

The Turkish zakat draft includes asset and payment entry, the Hijri anniversary, and print and export labels. The calculator accepts TRY and displays amounts with Turkish separators. Review the nisab and jewellery wording beside the cited guidance and check the printed totals against the saved figures.

The Turkish Return draft includes the istighfar counter, the seven Seyyidü’l-İstiğfar lines, the make-up prayer and fasting forms, and their source labels. Review the translations with the displayed Arabic and references, and check the differences in wording between Adult and Maktab.

The Turkish prayer guide draft includes the rakʿah instructions, the notes on losing count, and the Friday, Eid, funeral and Witr prayer topics. Check the labels against the cited passages and the prayer outline selected in settings. The draft also includes the controls and counters for the Umrah practice guide.

The Turkish Elifba and writing draft includes the lesson practice controls, the vowel explanations in both modes, and all nine writing families. Review the Turkish letter and vowel terminology alongside the marked Arabic, generated drills, and printable tracing sheets.

The Turkish Word Bank draft includes the 125 core Qur’an glosses, grammar labels, and review controls. Search uses Turkish case rules, including dotted and dotless I. Review each gloss alongside the Arabic lemma and the cited corpus.

The Turkish Word Anatomy and Fluency draft covers letter sounds, joining, roots, and examples from modern Arabic. It includes the curated Fâtiha and Asr word glosses and the word-by-word practice for phrases said in prayer. Review each gloss with its Arabic word and citation, especially where Turkish word order differs.

The Turkish reader draft covers short-sûre labels, recitation and review controls, the reading and teacher-practice screens, and Hadith search and attribution. Hadith search accepts collection names from the installed UI language. Check search against copied references and verify the grade and edition labels. Full Turkish translations of the Qur’an and Hadith need separate review and redistribution permission.

The Turkish learning paths draft covers placement, the learning map, and the memorisation plans and weekly review. It includes all 15 passage titles and the eight cited notes shown with them. Review the passage notes against their cited Hadith and the displayed grading, and check the wording of the three review stages.

The Turkish tecvid draft covers the eight essentials lessons, five in-depth lessons, all 17 articulation points, and the rule labels shown in the Qur’an reader. Review the rule wording with the marked examples, the continuation and stop labels, and the recitation excerpts.

The Turkish grammar draft covers all 22 lessons in Grammar Foundations, Roots & Patterns, and Sentence Structure. Review terminology for attached pronouns, verb patterns, and case endings alongside the cited Arabic. Check the Ibn Kesîr note with the linked passage and its attribution.

The Turkish sharing draft includes progress milestones, card templates, image formats, and controls for showing prayer counts. Check the headings and footer in both the preview and saved image. For cards containing a Qur’an meaning, verify the translation credit and language label.

The Turkish Umrah preparation draft covers trip details, the 12-item checklist, and the controls for offline packs and trip transfer. Ask in Arabic includes Turkish meanings for all 63 phrases and covers full-screen cards, directions, and the emergency panel. Review the phrasing with the spoken Arabic, especially when changing a gate number, destination, or family member. The emergency panel links to the official numbers. [Saudi emergency contacts](https://my.gov.sa/en/emergency-contact).

The Turkish live Umrah draft covers the daily plan, Harem focus, the seven ritual steps, the pocket guide, the installed map, and the sa‘y counter and location options. Review the ritual wording with the cited sources and test corrections as the route alternates between Safâ and Merve. The preview uses the English narration pack for Turkish.

The Turkish Speak draft covers course selection, all 36 Saudi, Emirati Gulf, and Modern Standard Arabic A1 lessons, and the nine Umrah and Hajj practice lessons. Review the lesson wording alongside the spoken Arabic, particularly the SIM dialogues, vocabulary and signs. Check that opening vocabulary in Word Anatomy or practising it in review keeps the Turkish meaning. The 18 phrases shared with Ask in Arabic use the same Turkish wording in both places.

The ten Turkish Gulf workplace lessons cover applications, shifts, contracts, pay, leave, safety and asking about workplace rights. Review workplace vocabulary with the spoken Emirati dialogues, particularly the terms for contract clauses, payroll deductions, and interpreters.

The Turkish Saudi Speak draft covers all 14 A2 and 12 B1 lessons, including the dialogues, vocabulary, signs, and reply choices. Review the A2 travel and services vocabulary and the B1 conversations about opinions, health, faith, and work alongside the spoken Arabic.

The Turkish desktop study draft includes the Adult plan customiser, Maktab study and sticker labels, and study history. It also covers install help, audio catalogue states, and reference recording controls. Review the browser menu labels on the platforms named in the install instructions.

The French draft covers all 4,042 messages in the current UI catalogue, including the landing page. Review the learning and pilgrimage terms at phone and desktop widths, including the short labels beside the ticks. Open `/awwab/lang/fr.html` in a French review build.

The French first-run draft also covers both learning modes, the reading placement, and prayer setup. Compare the welcome verse wording with the Arabic and citation. Check the city names, calculation method labels, and the distinction between the prayer guide reference and ʿAṣr calculation.

The French Today draft covers the current prayer, the prayer log and weekly history, calendar event labels, and all 17 Qaida lesson titles. Review prayer names and status labels against the selected glossary, and check the difference between a late prayer and a make-up prayer in the log.

The French prayer guide draft covers the rakʿa instructions, the notes on losing count, and guidance for Friday, Eid, funeral and Witr prayers. It also covers the controls and counters for Umrah practice. Check the notes against the displayed sources and the prayer guide reference selected in Settings.

The French Return draft includes the istighfār counter, all seven Sayyid al-Istighfār lines, and the forms for estimating and recording make-up prayers and fasts. Review the wording alongside the cited Arabic and check the Adult and Maktab instructions in context.

The French settings draft includes reading and display preferences, the language picker, backup and restore, reminders, and source credits. Review the wording for replacing records during a restore and check the prayer names in the exported calendar file.

The French planning draft covers the Hijri calendar, local moon-sighting confirmation, prayer reminders, mosque timetables and assignments, and Eid records. Compare the confirmed date in the calendar with the exported reminder. Review the WhatsApp wording with mosque names and the two Eid labels.

The French zakat draft covers assets, payments, the nisab and jewellery notes, and the Hijri anniversary. The printable sheets include the zakat summary and prayer timetable. Compare the totals in the saved data, the app, and the printed summary, including decimal commas and digit grouping in euro amounts.

The French Qaida and takhti draft covers 17 lesson titles, the Adult and Maktab introductions to short vowels, lesson audio controls, and nine letter families. Review the letter and vowel terminology with the marked Arabic, generated practice clips, and printable tracing sheets.

The French Word Bank draft covers all 125 core Qur’an glosses, grammatical categories, the root explorer, and the review controls. Search accepts uppercase input without accents. Review each gloss alongside its Arabic lemma and the cited corpus, and compare the examples in Qur’anic and modern Arabic.

The French Word Anatomy and Fluency draft includes letter sounds, joining forms, roots, the Al-Fātiḥa and Al-ʿAṣr glosses, and word-by-word prayer practice. Check the glosses beside the aligned Arabic and the cited sources, especially where the word order differs in French.

The French reader draft covers the Qur’an reader and recitation controls, preparation for reciting with a teacher, and Hadith search and attribution. Review Hadith collection names with copied references and the displayed grades. Full Qur’an meanings and Hadith translations in the preview use the attributed English editions while French editions await review and redistribution permission.

The French learning paths draft covers placement, the Maktab learning map, and the memorisation plan and weekly recitation check. Review the 15 passage titles and the eight passage notes alongside their cited Hadith and grades. Check the wording for the Sabaq, Sabqi and Manzil review stages.

The French tajwīd draft covers all eight essentials lessons, five in-depth lessons, and 17 articulation points. Review the rule descriptions against the marked examples and cited recitations, including the differences between the IndoPak and uthmani pause signs.

The French grammar draft covers all 22 lessons in Grammar Foundations, Roots & Patterns, and Sentence Structure. Review the terminology for pronouns, verb forms, and case endings with the Arabic examples. Compare the Ibn Kathīr note with its attribution and linked verse.

The French sharing draft covers milestones, card templates, image formats, and the prayer-count setting. Review the image text at all three sizes. Check that a card with a Qur’an meaning keeps the translator credit, language label, and fixed Awwab link.

The French Umrah preparation draft covers trip details, the 12-item checklist, offline packs, and trip file transfer. Review the wording for replacing a saved trip, including its list of invocation requests, when importing a file.

The French Ask in Arabic draft includes all 63 phrase meanings, the full-screen helper replies, hotel and lost cards, and the emergency panel. Review the variable phrases with the Arabic and generated recordings, including the gate number, destination, and family member. Compare the emergency labels with the official guide. [Saudi emergency numbers](https://apd.gov.sa/web/content/84584).

The French live Umrah draft covers the daily plan, Haram focus, the ritual steps and pocket guide, offline maps, and the saʿy counter. Review the wording with the cited sources and check the directions between Ṣafā and Marwa. The preview offers a downloadable French narration pack with generated speech for all seven steps. Use the lesson audio review export to check the transcripts and pronunciation alongside the cited sources.

The French desktop study draft includes the plan customiser, Maktab stickers, study history, the install instructions, and reference recording controls. Check the browser menu labels on the platforms named in the install instructions.

The French Speak draft includes course selection, all 36 Saudi, Emirati Gulf, and Modern Standard Arabic A1 lessons, and the nine Umrah and Hajj practice lessons. The 18 lines shared with Ask in Arabic use the same French meanings. Review the dialogue, vocabulary and signs alongside the generated Arabic audio.

The ten French Gulf workplace lessons cover applying for work, shifts, contracts, pay, leave, safety, and asking about workplace rights. Compare the terms for contract clauses, payroll deductions, and interpreters with the Emirati dialogues.

The French Saudi Speak draft also covers all 14 A2 and 12 B1 lessons, including the dialogues, vocabulary, signs and replies. Review the wording alongside the spoken Arabic, including the conversations about health, faith, and work.

The Malay draft covers all 4,042 messages in the current UI catalogue, including the landing page, navigation, metadata and image descriptions. Review the terms for solat, qada, cerapan anak bulan and sa‘i in context. The local review page is `/awwab/lang/ms.html` and uses `ms.draft.json` from the review export.

The Malay setup draft includes the welcome screens, the Adult and Maktab choices, the placement questions and audio controls, and the prayer setup form. Review the wording for the prayer guide and the separate Asar calculation setting. The regional references specify 18° below the horizon for both Subuh and Isyak. Verify zone reference points, rounding and adjustments against the official timetable before offering the proposed Malaysian method in setup. [Selangor Mufti on Subuh](https://www.muftiselangor.gov.my/2025/07/03/15-taudhih-al-falak-fajar-sadiq-dalam-menentukan-permulaan-waktu-solat-subuh/), [Federal Territories Mufti on prayer timetables](https://muftiwp.gov.my/en/artikel/bayan-al-falak/5088-bayan-al-falak-siri-ke-5-isu-ketepatan-waktu-solat-dalam-takwim-waktu-solat-pejabat-mufti), [Selangor Mufti on zones and rounding](https://www.muftiselangor.gov.my/soalan-lazim/).

The Malay Today draft includes the prayer countdown, prayer logging and weekly history, the daily study plan, Qaida lesson titles and upcoming Hijri events. Review Subuh, Zohor, Asar, Maghrib and Isyak alongside the saved prayer status and local jemaah time. Check the translated event descriptions against their cited guidance.

The Malay settings draft includes the profile, display, reading help, terminology choices, wording suggestions, backups, reminders and source credits. Review the warning about replacing on-device records during restore and the prayer names in the exported calendar file.

The Malay planning draft includes Hijri dates and moon-sighting confirmations, mosque timetables, weekly assignments, and Eid and Tarawih records. Review the date choices and confirmation sources with the exported reminder. Check the WhatsApp questions with the mosque and occasion names filled in.

The Malay zakat draft covers assets, nisab, haul, payments and print sheets. The calculator can store and display amounts in Malaysian ringgit. Review the description of scholarly differences about worn jewellery with the cited guidance, and compare the totals in the calculator and printed summary.

The Malay Qaida and Takhti draft covers all 17 lesson titles, practice and recording controls, nine letter families and the printable tracing sheets. Review the wording for the short vowels in both Adult and Maktab alongside the marked letters and generated practice clips.

The Malay Word Bank draft covers all 125 core glosses, word types, and the examples that connect Quranic and everyday Arabic. Compare the glosses with their original words and the Quranic Arabic Corpus credit. Check that the saved review state and the meanings shown during review use the same terms as the table.

The Malay prayer guide draft covers each rakaat, the lost-count guidance, and the Jumaat, Eid, funeral and Witr topics. Review the wording against the linked sources and the prayer outline selected in settings. The Umrah practice draft includes separate counts for tawaf rounds and sa‘i journeys.

The Malay Return draft covers the istighfar counter, all seven Sayyidul Istighfar lines, the return history and the qada solat and fasting forms. Review the wording alongside the cited Arabic, including the note on differing scholarly opinions about previously missed prayers.

The Malay Word Anatomy and prayer study draft includes the Al-ʿAsr word example, the curated Al-Fātiḥah and Al-ʿAsr glosses, and word-by-word meanings for common prayer phrases. Review the glosses in Arabic reading order, including the phrases that span several words. Check the distinction between connected letter forms and modern examples.

The Malay Quran and Hadith reader draft covers searches, source labels, Qur’an reading and review, and the teacher preparation checklist. Compare the labels with the verse and narration references. The preview retains the attributed English editions for full translations while local editions await clearance and review.

The Malay learning paths draft includes placement, the Maktab map, and memorisation plans and weekly checks. Review the 15 passage names and the eight passage notes alongside their cited references and grades. Check the wording for Sabaq, Sabqi and Manzil as a portion moves through review.

The Malay tajwid draft covers the basic and advanced lessons, all 17 makhraj descriptions, and the rule labels shown in the reader. Compare the wording with the marked examples, recordings and sources. Review both scripts where the pause marks or vowel signs differ.

The Malay grammar draft covers all 22 lessons for grammar foundations, roots and patterns, and sentence structure. Review the terminology for Arabic verb forms and i‘rab alongside the cited examples. Compare the Al-Kawthar note with the linked attribution to Ibn Kathīr.

The Malay share draft covers milestones, card templates, image formats and the prayer-count setting. Review the text in each image size with the numbers hidden by default. Check the translator credit, verse range and Awwab link on the surah card.

The Malay Umrah preparation draft includes trip details, the 12-item checklist, offline pack labels and trip file transfer. Review the import warning with particular attention to the trip details and prayer request list that the imported file replaces.

The Malay live Umrah draft covers the daily plan, Haram focus, all seven ritual steps, the printed pocket guide, and the offline map and sa‘i counter. Review the distinction between tawaf rounds and sa‘i journeys, the direction labels and the description of optional location use. The preview offers generated Malay narration for every step. Compare those recordings with the written transcripts, paying particular attention to the ritual names, counts and place names.

The Malay Ask in Arabic draft includes all 63 phrase meanings, helper replies, hotel and lost cards, and the emergency panel. Review the gate, destination and family variables alongside the existing generated Arabic recordings. Compare the emergency labels with the Saudi guide. [Saudi emergency numbers](https://apd.gov.sa/web/content/84584).

The Malay desktop study draft includes the plan customiser, Maktab stickers, study history, reference recording controls and installation instructions. Check the browser menu wording on the platforms named in the instructions.

The Malay speaking draft covers course selection, the twelve Saudi Hijazi A1 lessons and the nine Umrah and Hajj lessons. Check the dialogue, vocabulary and signs against the Arabic recordings. Eighteen lines in the pilgrimage lessons reuse the same meanings as Ask in Arabic.

The Malay A1 draft also covers the twelve Emirati Gulf lessons and the twelve Modern Standard Arabic lessons. Compare the Malay dialogues, vocabulary and signs with the recordings for each variety.

The Malay Gulf workplace draft covers ten lessons about applying for work, contracts, shifts, pay, leave, safety and asking about rights. Review the terms for clauses, deductions and interpreters in the context of the Emirati dialogues.

The Malay Saudi speaking draft includes all fourteen A2 and twelve B1 lessons. Review the dialogue, vocabulary, signs and reply choices alongside the generated recordings, including the conversations about health, faith and work.

The Persian landing draft covers all 214 landing messages, including navigation, metadata and image descriptions. The local review page is `/awwab/lang/fa.html` and uses `fa.draft.json` from the review export. Review the terms for makeup prayer, letter joining and the separate journeys of saʿy with Persian and Dari readers.

The Persian setup draft covers the welcome text, Adult and Maktab choices, all eight placement questions, and the prayer setup form. Review the Persian numerals, the Al-Isrāʾ excerpt, and the distinction between the prayer guide and the method used to calculate Asr. The proposed Jaʿfari scope requires the separate decision in §3.

The Persian Today draft covers prayer times, logging and weekly history, the daily study plan, all 17 Qaida lesson names, and upcoming Hijri events. Review the wording for prayers read in time, prayers read later and makeup prayers. Compare the Hijri event descriptions with the cited guidance in the planning views.

The Persian settings draft covers the profile, reading and display preferences, wording suggestions, backups, calendar reminders and source credits. Check the replacement warning during restore, the display of Persian digits, and the prayer names in the exported calendar file.

The Persian Qaida and Takhti draft covers the practice and recording controls, nine letter families and printable tracing sheets. Compare the short-vowel descriptions with the marked examples and generated clips. The Qaida row numbers follow the selected digit preference.

The Persian Word Bank draft covers all 125 core glosses, word types and examples that connect Quranic and everyday Arabic. Review the glosses against the Arabic and the Quranic Arabic Corpus credit. Word Bank search matches forms typed with Persian kāf and ye to the corresponding Arabic letters.

The Persian planning draft covers Hijri date confirmations, mosque timetables, weekly mosque assignments and the Eid and Tarawih records. Review the words for estimated and confirmed dates with the calendar export. Check the WhatsApp questions with mosque and occasion names filled in.

The Persian zakat draft covers assets, nisab, hawl, payments and the print sheets. The calculator accepts Iranian rials (IRR) and Afghan afghanis (AFN). Review the wording about worn jewellery and the choice of nisab against the cited sources. Compare the saved currency and totals with the printed summary. [ISO 4217 currency list](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml).

The Persian prayer guide draft includes the rakʿah steps, the lost-count guidance, and the Friday, Eid, funeral and Witr topics. Review the wording and displayed grades alongside their sources and the selected prayer outline. The Umrah practice draft distinguishes an individual saʿy journey from a tawaf round.

The Persian Return draft covers the istighfar counter, return history, all seven Sayyid al-Istighfār lines, and the makeup prayer and fasting forms. Review the lines alongside the cited Arabic. Check the distinction between an estimate and a saved balance, and review the note on differing scholarly views about deliberately missed prayers.

The Persian Word Anatomy and prayer study draft covers the Al-ʿAsr example, the curated Al-Fātiḥah and Al-ʿAsr glosses, and the word-by-word meanings of common prayer phrases. Review the glosses against the matching Arabic words, including phrases whose order differs in Persian. Check the examples that connect Quranic roots to everyday Arabic.

The Persian Umrah narration draft includes all seven generated tracks and their transcripts, step titles, notes and playback controls. Compare the recordings with the transcripts and sources in the lesson audio review export. Automated transcription misheard parts of the two-rakʿah heading and some place names. Check those passages by ear, as well as the counts and directions in the tawaf and saʿy tracks.

The Persian Quran and Hadith reader draft covers search, source labels, reading and review controls, and the teacher preparation checklist. Check collection names and references with Persian digits. The preview uses the attributed English editions for full translations while local editions await clearance and review.

The Persian learning paths draft includes placement, the Maktab map, memorisation plans and weekly recitation checks. Review all 15 passage names and eight passage notes alongside their references and grades. Compare the labels for Sabaq, Sabqi and Manzil as a portion moves through review.

The Persian tajweed draft covers the basic and advanced lessons, all 17 articulation points, and the rule labels in the reader. Compare the terms for breath, sound flow and the heavy and light forms of rāʾ with the marked examples and cited recordings. Check the pause signs in both scripts.

The Persian grammar draft covers all 22 lessons on grammar foundations, roots and patterns, and sentence structure. Review the numbered verb forms and the terminology for case endings alongside the Arabic and the cited āyāt. Compare the Al-Kawthar note with the linked explanation by Ibn Kathīr.

The Persian share draft includes milestone text, templates, image sizes and the prayer-count setting. Check the right-to-left text in each image size and review the Return card with the counts hidden and shown. Compare the surah card credits, verse range and Awwab link with the preview.

The Persian Umrah preparation draft covers the trip details, 12-item checklist, offline pack labels and trip file transfer. Review the wording for the Arabic hotel fields and the import warning about replacing the trip details and duʿā request list.

The Persian live Umrah draft covers the itinerary, Haram focus, printed guide, offline maps and saʿy counter. Review the distinction between a tawaf round and a saʿy journey, the labels for each direction, and the wording about optional location access.

The Persian Ask in Arabic draft includes all 63 phrase meanings, full-screen helper replies, hotel and lost cards, and the emergency panel. Review gate, destination and family-member wording with the generated Arabic recordings. Compare the emergency labels with the official Saudi guidance. [Saudi emergency guide](https://apd.gov.sa/web/content/84584), [national emergency directory](https://my.gov.sa/en/emergency-contact).

The Persian study draft covers the desktop plan customiser, Maktab stickers, study history, installation instructions and reference recording controls. Check browser menu labels against the devices used for review and try the digit preference in both Adult and Maktab.

The Persian Speak draft includes the shared lesson controls, 12 Saudi A1 lessons and nine Umrah and Hajj lessons. Review the vocabulary alongside the generated Arabic, including the 18 lines shared with Ask in Arabic. Check the difference between the labels for the saʿy and tawaf areas on the signs.

The Persian draft covers all 4,042 entries in the current UI catalogue. In Speak, compare everyday expressions across the 24 Gulf and Modern Standard A1 lessons. Review shifts, contracts, pay and workplace rights in the ten Working in the Gulf lessons. In the 26 A2 and B1 lessons, compare the sermon and news vocabulary, reply choices and Quran root references with the Arabic text and audio.

The Hausa draft includes all 214 landing-page entries, including navigation, image descriptions and metadata. Open `/awwab/lang/ha.html` in a review build using `ha.draft.json`. Check the hooked letters ɓ, ɗ and ƙ at phone and desktop widths and review the terms for sallah, ramuwa, alwala and Umara in context.

The Hausa onboarding draft covers the welcome screen, learning mode, placement check, prayer setup and backup restore. Review the Ka’ida vocabulary and the wording for choosing a calculation method and entering a city, including the labels for Asuba, La’asar and Lisha.

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
