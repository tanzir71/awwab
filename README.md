# Awwab

Awwab is an offline-first app for returning to regular prayer and relearning Quranic Arabic. It stores prayer logs, learning progress, and trip details in IndexedDB on the device. There are no accounts or analytics.

## Run locally

Use Node.js 22 or later and npm.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

The landing page is at `/awwab/`. The installable app is at `/awwab/app/`. Use the production preview to test offline behavior. Open the app once online and wait for its service worker to activate, then reload with the network disabled.

## GitHub Pages

The Pages workflow checks each pull request. A build from `main` publishes the `dist` artifact when the repository uses GitHub Actions as its Pages source. The app uses hash routes inside `/awwab/app/`, and its service worker is scoped to that directory.

## Content and map packs

The repository includes versioned Quran, hadith, morphology, and map assets. Normal installs and builds use the checked-in assets.

- `npm run content` refreshes the supported surahs from Tanzil, Pickthall, and DigitalKhatt.
- `npm run hadith` refreshes Hadith API editions and retains explicitly graded entries without conflicting weak grades.
- `npm run morphology` prepares the verbatim Quranic Arabic Corpus 0.4 file for offline use.
- `npm run recitation` refreshes opt-in murattal audio packs from Aaqib Azeez’s CC0 recordings.
- `python scripts/build-landing-font.py` refreshes the landing page’s Arabic font subset after copy changes. It uses FontTools and Brotli.
- `node scripts/build-umrah-pins.mjs` refreshes selected Haram features from OpenStreetMap.
- `pwsh -File scripts/build-umrah-maps.ps1` uses the Protomaps CLI to prepare and verify the Makkah and Madinah packs.
- `AWWAB_CONTENT_DIR` can point the content refresh scripts to a directory of existing source files.

The app shows attributions in **You → Sources and licences**. Asset terms are in [public/data/licences](public/data/licences). The product and architecture are in [docs/SPEC.md](docs/SPEC.md).

Before public launch, complete the religious content review in SPEC §12. Awwab includes downloadable whole-surah recordings. You can also import recordings for individual āyāt, Qaida drills, or Umrah guidance on your device.
