# Handovers (planned work, not part of the current build)

This folder holds the **next** Codex handovers for awwab. Nothing here should be built until its handover is started.
Each handover has its own README with scope, Figma frames, acceptance criteria and seed data.

| # | Handover | When | Why |
|---|---|---|---|
| H1b | [Desktop coverage](H1b-desktop-coverage/README.md) | **Start now**, alongside the current phase | Many desktop screens (onboarding, zakat, plan, settings…) had no desktop design and are being built as stretched phone screens. |
| H2 | [Languages, learning paths & Arabic help](H2-languages-paths-arabic-help/README.md) | After the current phase ships | App language switching for non-Arabic-speaking Muslim countries, learning beyond the basics (advanced surahs, tajweed, grammar, spoken Arabic), and an Arabic phrase assistant in Umrah mode. |

## How to start a handover
1. Give Codex the handover README as the task, plus `AGENTS.md` and `docs/SPEC.md` (they still apply).
2. Add one line to `AGENTS.md` under the phases list: `Active handover: handovers/<folder>/README.md`.
3. Hard rules never change: no backend, fully offline after first load, tokens only, no container borders, every Arabic word spells itself out, mercy-first copy, sources shown.

Figma file: https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest
- Desktop coverage frames: page **Desktop & Print** (23:1597)
- H2 frames: page **H2 · Languages, learning paths & Arabic help** ([74:143](https://www.figma.com/design/cZzhFbOND8BtWNmryfFnIf/Prayer-Quest?node-id=74-143))
