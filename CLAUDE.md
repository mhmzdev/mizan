# Mizan — Infinite Timeline

A local-first historical timeline (4001 BC → 2026 AD) for navigating and annotating history. Users scroll horizontally through time, zoom between century/decade/year views, and attach notes to specific years across multiple named timelines.

## Stack
- **Next.js 15** App Router, `src/` dir, `@/*` alias
- **Tailwind CSS v4** — custom theme via `@theme` in `globals.css`
- **Zustand 5** — all UI state (`timelineStore`, `notesStore`, `dialogStore`, `settingsStore`)
- **Dexie (IndexedDB)** — local note + timeline persistence (`src/lib/db.ts`)
- **Framer Motion** — panel animations and zoom transitions
- **Roboto Mono** — sole font (loaded via `next/font/google`, self-hosted at build time)
- **Lucide React** — icons

## Dev
```
npm run dev    # http://localhost:9999
npm run build  # must pass before every ship — catches type errors
```

## Year Coordinate System
**This is the most important domain concept. Every feature touches it.**

Internal representation: integers from `YEAR_START = -4000` (4001 BC) to `YEAR_END = 2025` (2026 AD).
- `year < 0` → display as `Math.abs(year) + " BC"` (e.g. `-44` → `"44 BC"`)
- `year >= 0` → display as `(year + 1) + " AD"` (e.g. `0` → `"1 AD"`)
- Implemented at `src/utils/yearUtils.ts:formatYear(year, notation?)`
- **In components always use `useFormatYear()`** from `src/hooks/useFormatYear.ts` — it reads the user's notation setting automatically (BC/AD | BCE/CE | BH/AH)

Pixel position: `px = (year - YEAR_START) * pxPerYear`

## Critical Patterns

**Navigate the timeline programmatically** — always use `setPendingNav({ year, zoom })` from `timelineStore`. Never mutate `scrollLeft` directly except inside `TimelineContainer`.

**Continuous zoom** — `pxPerYear` is a live float, not a discrete mode string. Zoom snapshots live in `PX_PER_YEAR` (`src/utils/constants.ts`) but the store holds an arbitrary number in `[MIN_PX_PER_YEAR, MAX_PX_PER_YEAR]`.

**Notes are in IndexedDB** — all note/timeline reads go through `src/stores/notesStore.ts` which wraps `src/lib/db.ts` (Dexie). Never read `db` directly from a component.

**Timeline colors** — always use `getTimelineColor(index)` from `src/utils/timelineColors.ts` — never hardcode a color for a timeline lane.

## Deep Dives
- Architecture, file map, store shapes, z-index ladder, persistence keys → `docs/architecture.md`
- Conventions and patterns for adding features → `docs/patterns.md`
- Planned and shipped features → `docs/features/`
- Bug log → `docs/bugs/`
