# 02 · Learning beyond the basics

Users finish the Qaida and the shortest surahs, then need somewhere to go. Four paths, five levels each. Levels only suggest an order; any level can be opened any time.

Figma: A28 Paths [79:70](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=79-70) · A29 Memorise levels [79:194](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=79-194) · A30 Al-Mulk plan [79:265](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=79-265) · A31 Tajweed: nūn sākin [79:327](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=79-327) · A32 Roots & patterns [80:163](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=80-163) · A33 Speak setup [80:241](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=80-241) · A34 Speak lesson [80:305](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=80-305) · M20 Maktab map [80:383](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=80-383) · DA6 Paths (desktop) [92:348](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=92-348) · DA7 Speak workspace [92:714](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=92-714).

Curriculum: [`data/learning-paths.json`](data/learning-paths.json) · Essential passages: [`data/essential-passages.json`](data/essential-passages.json)

## Paths
| Path | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| **Read** | Qaida (17) | Fluent reading | Tajweed essentials | Tajweed in depth | Recite with a teacher |
| **Memorise** | Salah essentials | Juz ʿAmma (37) | Essential passages | Friday & Eid | Hifz by juz |
| **Understand** | 125 core words | Grammar foundations | Roots & patterns | Read with meaning | Sentence structure |
| **Speak** | A1 Survival | A2 Everyday | B1 Conversation | Umrah & Hajj pack | Working in the Gulf pack |

The Paths hub (A28) shows one **Recommended next** item, the four paths with a 5-step level bar, and a "5-minute check" per path (extends A03).

The Bangla preview covers all 20 level names, level summaries, placement recommendations, the Read and Understand starter outlines, and essential passage titles. The placement check uses the existing attributed English Quran edition for revealed meanings.

Placement checks show the selected Quran script and cite each displayed āyah. The Speak check uses four generated Saudi Arabic answers bundled for offline playback. Recalling all four suggests A2 Everyday.

## Memorise
- **Essential passages** (A30): Āyat al-Kursī, last two āyāt of Al-Baqarah, Al-Mulk, As-Sajdah, first ten of Al-Kahf, end of Āl ʿImrān, Yā-Sīn, Ar-Raḥmān, Al-Wāqiʿah, end of Al-Ḥashr.
- **Virtues rule:** show a "Why this surah" card only with a ṣaḥīḥ or ḥasan source (collection, number, grade). Where narrations are weak (Yā-Sīn, Al-Wāqiʿah …) say so and show none.
- **Portioning:** split a surah into portions of ≤ 5 āyāt or ≤ 40 words, never splitting an āyah. Very long āyāt (e.g. 2:255) are learned in phrase chunks at waqf marks but reviewed whole.
- **Plan:** user chooses minutes per day; the app proposes portions per N days and an end date (A30: Al-Mulk = 6 portions, ~3 weeks at 7 min/day).
- **Daily review (maktab method + SRS):** Sabaq (today's new portion) → Sabqi (portions from the last 7 days) → Manzil (older portions, FSRS-due). A portion graduates from Sabaq after "Got it" on 3 different days.

## Read
- Qaida lessons 1, 2, 4, 5 and 8 include generated audio for each practice row and for the full drills. Learners can keep using their own imported recordings. Rebuild the drills and the short-vowel placement clips with `python scripts/build-generated-speech.py <emirati-model.onnx> --qaida` using `piper-tts==1.8.0` and FFmpeg. The drills use explicit pronunciations for isolated vowels and tanwīn. Native pronunciation review is pending. [Emirati Piper model and config](https://huggingface.co/vadimbelsky/arabic-emirati-female-piper/tree/cfe173969620e40be65b5dd8ed4d97d55a864325)
- Tajweed lessons (A31) = rule card (what, letters, Quranic example, audio) → "spot the rule" drill → read 8 words → record & compare.
- Colour-coded tajweed reading uses tokenised colours (never colour alone; the rule name is always available on tap). Tajweed annotation data: QUL tajweed layer (verify licence) or hand-authored for Juz ʿAmma.
- Fluent reading and Recite with a teacher can mark selected examples from the bundled Tajweed Essentials lessons in both scripts. A double underline identifies a marked word. Its Word anatomy panel names the rules and links to the lessons. Full Juz ʿAmma coverage and scholar review are pending.
- Level 5 never claims to certify. It prepares the user to recite to a local teacher.

## Understand

- Locale review exports include Grammar Foundations, Roots & Patterns, and Sentence Structure lesson text, examples, and drill questions. Keep `{arabic}` and `{reference}` in the translated messages that use them. Awwab inserts the original Arabic and formats the cited āyah using the reader’s digit preference.
- Builds on Word anatomy: every lesson example is tappable.
- Roots & patterns (A32): root card + pattern table (فَعَلَ يَفْعُلُ فَاعِل مَفْعُول فِعَال مَفْعَل) + "Spot it in the Quran".
- Morphology: QUL morphology or the Quranic Arabic Corpus (GPL: check compatibility before bundling).

## Speak (functional modern spoken Arabic)
- **Variety first** (A33): Saudi · Hijazi (recommended for Umrah/Hajj, ships first), Gulf, Modern Standard; Egyptian and Levantine later. Goal chips: Umrah & Hajj, Working in the Gulf, Everyday talk, Khutbahs & news.
- **Unit steps:** Listen → Words → Repeat (record & compare) → Your turn (choose a reply from scripted options; no speech recognition, no AI) → Read the sign (unvowelled street text).
- **Root bridges:** link spoken words to Quran roots the user already knows (A34: شريحة *sharīḥa* "SIM card" shares the root ش ر ح with أَلَمْ نَشْرَحْ, 94:1).
- **Content:** dialogues written and recorded by native speakers of each variety; transliteration scheme consistent with the rest of the app; English and app-language translations.
- Locale review exports include Speak lesson titles, speaker names, dialogue meanings, vocabulary and signs from the seven course files. Shared phrases use the existing Ask in Arabic keys. Installed language packs apply these translations offline, including to word review.
- Shares audio and phrases with Ask in Arabic (03) for the Umrah & Hajj pack.

## Maktab
- M20 learning map: islands (Letters → Harakat → Joining → Short surahs → Juz ʿAmma → Tajweed stars), 5 stars per island, stickers on completion. Same content, shorter sessions (≤ 3 min).

## Data model (additions)
```ts
PathProgress { track: 'read'|'memorise'|'understand'|'speak', level: string, unit?: string, status: 'locked'|'open'|'now'|'done', startedAt?, doneAt? }
Portion { id, surah, fromAyah, toAyah, words, bucket: 'sabaq'|'sabqi'|'manzil', fsrs }
SpeakSettings { variety: 'saudi-hijazi'|'gulf'|'msa', goal: string[] }
ReviewCard.kind += 'portion' | 'rule' | 'phrase' | 'pattern'
```

## Acceptance
- Paths hub, levels and unit screens match the frames; progress and SRS work offline.
- Every passage shows its range; virtue cards appear only with ṣaḥīḥ/ḥasan sources.
- Portioning never splits an āyah; plan dates update when the daily minutes change.
- Speak A1 (Saudi) complete with audio for all 12 units; all Arabic in lessons opens Word anatomy.
- Scholar review: tajweed rules, essential passages and grades. Native review: every Speak dialogue.
