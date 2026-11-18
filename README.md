# Prayer Quest

A small installable web app for tracking the five daily prayers. It shows today's prayer times for your location, lets you tick off each prayer as you complete it, and turns your streak into a mosque that is gradually built.

## Features

- Today's times for Fajr, Dhuhr, Asr, Maghrib and Isha, fetched from the Aladhan API (`api.aladhan.com`, calculation method 2) for your coordinates.
- Location from the browser's geolocation, falling back to an IP lookup (`ipapi.co`), then to Mecca if both fail.
- Each prayer lists its rakat breakdown (Sunnah, Fard, Nafl, Witr) and order.
- Mark prayers complete or undo; completions are stored in the browser's `localStorage` and nothing is sent to a server.
- Statistics tab: current streak, best streak, completion rate, total prayers completed and active days.
- A mosque illustration that advances through stages (foundation, walls, dome, minarets, complete) as your streak grows.
- PWA pieces: web manifest, service worker for the app shell, and an install prompt for mobile browsers.

## Tech stack

Vite, React 18 and TypeScript, Tailwind CSS, shadcn/ui (Radix UI), Lucide icons. The project was scaffolded with Lovable.

## Getting started

Prerequisites: Node.js and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints. Allow location access for times at your position; prayer times require network access.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

## Project structure

- `src/pages/Index.tsx` - main screen with the Today and Statistics tabs.
- `src/lib/prayerServices.ts` - prayer-time fetching and rakat data.
- `src/lib/storageService.ts` - completion tracking and streak statistics in `localStorage`.
- `src/components/` - prayer timeline, mosque progress, install prompt, footer.
- `public/` - manifest, service worker and icons.
