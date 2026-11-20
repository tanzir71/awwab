# 03 · Ask in Arabic (Umrah mode)

An offline phrase assistant for the moments you need help from someone nearby and don't share a language: finding a toilet or wudu area, a gate, Zamzam, a SIM card, a taxi to the hotel, a pharmacy, or saying "I'm lost".

Figma: U06 Ask home [83:231](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=83-231) · U07 Phrase card [83:385](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=83-385) · U08 Show to them [83:492](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=83-492) · U09 My cards [83:549](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=83-549) · desktop practice in DC11 [89:2789](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=89-2789).
Phrases: [`data/umrah-phrases.json`](data/umrah-phrases.json) (63, Saudi Hijazi + formal) · Answer words and digits: [`data/reply-words.json`](data/reply-words.json).

## Where it lives
- Umrah tab bar is now **Now · Rituals · Map · Ask · Duʿās** (`UmrahTabBar` 26:1258; Plan moved into Now). Also reachable from the long-press menu on the Now card and from the map ("Ask the way").
- Works with no network: phrases, audio and cards ship in the **Ask in Arabic** pack (≈ 6 MB), downloaded with the other Umrah packs.

## Screens
**U06 Ask home**
- Night header with Makkah time and a variety toggle (**Saudi** default · Formal).
- "You're in the Haram · quick asks": suggestions from the Umrah context engine (state chip or geofence). Mapping uses each phrase's `contexts` (haram → toilet, wudu, Zamzam, women's area, gate number, I'm lost; hotel → Wi-Fi, key, checkout, taxi; eating → water, not spicy, bill …). "I'm lost" is always present and tinted danger.
- Search in English **or the app language** (e.g. বাংলা), across `en` and translated fields.
- 8 categories: Directions · Phone & SIM · Taxi & bus · Food & water · Health & help · Hotel · Shopping · Polite words.
- My cards: hotel card, "If I'm lost" card. Tip: many staff speak Urdu, Bengali or Indonesian (phrase `speak-urdu` etc.).

**U07 Phrase card**
- Big Arabic (Noto Sans Arabic 44), transliteration, English, app-language translation. Every word is a WordChip → Word anatomy (principle: all Arabic spells itself out).
- **Play aloud** (primary, loudest), Slow (0.75×), Voice (male/female). Saudi/Formal toggle swaps text and audio.
- **Show to them, full screen** → U08.
- "Their answer might be": 8 answer words with arrows (right, left, straight on, upstairs, downstairs, near, far, behind) from `reply-words.json`.
- "Look for this sign": the Arabic signage text (e.g. دورات المياه "Toilets").
- Gendered forms: when a phrase has `gender` variants, use the speaker's gender from settings (asked once, skippable) and offer the to-female form of "excuse me" with a tap.

**U08 Show to them**
- Light, high-contrast, huge Arabic (52) with a polite opener (لو سمحت), the place name, and small transliteration + English for the user.
- Slots: gate number entry shows the number in **Arabic-Indic digits** (79 → ٧٩), which is also how it appears on many signs; "Change" opens a number pad.
- **Helper taps the answer:** a night panel says اضغط على الاتجاه ("tap the direction") with 5 big Arabic buttons (يمين · سيده · يسار · فوق · تحت). The tap shows the user the meaning in the app language and logs nothing.
- Keep the screen on with the **Screen Wake Lock API**; prefer landscape-friendly layout. (A PWA cannot set brightness; the white high-contrast layout is the substitute.)

**U09 My cards**
- **Hotel card:** the hotel's Arabic name and address, entered by the user (copied from the booking or the hotel's card; the app does not translate names), plus "Take me to this hotel" audio (`take-me-hotel`) and a show mode.
- **If I'm lost:** أنا ضايع/ضايعة + "Please call this number" with the group leader's name and number (tap to call), show-full-screen and play.
- **Emergency:** 911 (unified emergency number in the Makkah and Madinah regions); elsewhere in Saudi Arabia 997 ambulance, 999 police. Cards never leave the device.

## Audio pack
- Generate a male and a female voice for both varieties. A native Saudi Hijazi speaker reviews the Saudi lines, and an Arabic teacher reviews the Modern Standard Arabic lines.
- Format: Opus, mono, 48 kHz, 32 kbps; loudness −16 LUFS integrated, −1 dBTP peak; 150 ms head/tail silence; file path `phrases/<variety>/<voice>/<id>.opus`.
- Slots: record "fēn bāb raqam" and number words 1–300 separately; concatenate at play time with 60 ms crossfade. Hotel names are not spoken (shown only), unless the user records their own clip.
- Playback through Web Audio at full gain; show a one-time "turn your volume up" hint.
- Custom phrases: users can add a phrase by pasting Arabic text and their own meaning. Played with the device's Arabic voice (`speechSynthesis`) if one is available offline, otherwise shown only, and labelled "device voice".

Publish the reviewed Opus files under `public/packs/phrases/<variety>/<voice>/`. Use the phrase ID for standard clips, `gate-number.opus` for the gate prefix and `number-1.opus` through `number-300.opus` for the numbers. The bus and family phrases use complete clips with the slot appended to the ID, such as `bus-to-madinah.opus` and `lost-family-mother.opus`. Use `-speaker-female` or `-to-woman` for the corresponding alternative forms in the phrase data. The version 2 manifest at `docs/content/umrah-phrase-audio.json` records the combined size and credits for each voice. Female clips from version 1 stay playable during the upgrade. The app installs recordings on request and reads the saved files for offline playback.

The speech builder writes a checksum for every recording. Run `python scripts/build-generated-speech.py --ask-manifest` to regenerate the checksum index and manifest from existing audio. Keep both files with the matching clips. Download and repair verify the index and each clip. Repair keeps matching cached audio and fetches missing or changed clips.

Run `node scripts/export-ask-review.mjs <new-directory>` to prepare the offline pronunciation review. Share the whole directory as a ZIP if needed. Open `index.html` in a browser after extracting it. The viewer shows the published Arabic, transliteration and English beside the generated recordings, including both audio segments for every gate from 1 to 300. Each reviewer exports their own decisions and notes. The review file identifies the exact text and recordings so corrections can be applied to the right revision.

## Phrase translations

English and Bangla meanings are bundled with the phrase data. The locale review export includes each phrase as `askPhrase-<id>` and each sign as `askSign-<id>`. Keep the ICU arguments for gate numbers, destinations and family members in the translation. The destination and family labels have their own catalogue entries.

The phone phrase cards, Show mode and desktop practice use the downloaded catalogue offline. Search matches the selected translation, English, Bangla, Arabic and transliteration. Arabic text, variant selections and audio filenames continue to come from the phrase data.

## Data model
```ts
Phrase { id, category, en, saudi: { ar, tr }, msa: { ar, tr }, contexts: string[], slots?, gender?, sign?, urgent?, note? }
PhraseTranslation { id, locale, text }           // app-language meaning, per locale pack
UmrahCards { hotel: { nameAr, addressAr, nameEn }, lost: { leaderName, phone }, healthNote? }
AskSettings { variety: 'saudi'|'msa', voice: 'male'|'female', speakerGender?: 'male'|'female' }
```

## Acceptance
- All 63 phrases play offline in both varieties and both voices; slow mode works; text and audio always match.
- Context suggestions change with the Umrah state chip/geofence; "I'm lost" is always one tap from U06.
- Show mode keeps the screen awake; helper taps translate into the app language (tier-1 locales).
- Gate numbers render in Arabic-Indic digits and play correctly for 1–300.
- Review: every Saudi line approved by two native Hijazi speakers (one living in Makkah); formal lines by an Arabic teacher; translations by each locale's reviewers.
