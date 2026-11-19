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

The Pages workflow checks each main push and pull request. Run it on `main` with **preview** to publish a working milestone at `/awwab/app/` alongside the landing page. The preview signals that religious content review is pending. After completing SPEC §12, select **app** and confirm that review. To test the Pages preview build locally, run `npm run build -- --mode preview` followed by `npm run preview`. The app uses hash routes and its service worker is scoped to `/awwab/app/`.

## Content and map packs

The repository includes versioned Quran, hadith, morphology, and map assets. Normal installs and builds use the checked-in assets.

- `npm run content` refreshes the supported surahs from Tanzil, Pickthall, and DigitalKhatt.
- `npm run hadith` refreshes Hadith API editions and retains explicitly graded entries without conflicting weak grades.
- `npm run morphology` prepares the verbatim Quranic Arabic Corpus 0.4 file and derives the 125-word list and Fātiḥa lemma index. Add `-- --from-bundled` to regenerate the derived data from the checked-in corpus.
- `npm run recitation -- --from-local` regenerates the per-āyah MP3s from the checked-in Aaqib Azeez recordings with FFmpeg. The command without `--from-local` fetches the originals. The cut sheet pins each original by SHA-256 so a new recording requires new timings.
- `python scripts/build-landing-font.py` refreshes the landing page’s Arabic font subset after copy changes. It uses FontTools and Brotli.
- `node scripts/build-umrah-pins.mjs` refreshes selected Haram features from OpenStreetMap.
- `pwsh -File scripts/build-umrah-maps.ps1` uses the Protomaps CLI to prepare and verify the Makkah and Madinah packs.
- `AWWAB_CONTENT_DIR` can point the content refresh scripts to a directory of existing source files.

The app shows attributions in **You → Sources and licences**. Asset terms are in [public/data/licences](public/data/licences). The product and architecture are in [docs/SPEC.md](docs/SPEC.md).

Before public launch, complete the religious content review in SPEC §12. The opt-in audio packs include whole-surah recordings and individual āyāt for all 12 study surahs. You can also import your own recordings for a surah, an āyah, a Qaida drill, or Umrah guidance.
