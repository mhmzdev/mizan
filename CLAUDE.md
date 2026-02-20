# Mizan — Infinite Timeline

A high-performance, virtualized historical timeline (4001 BC → 2026 AD) built with Next.js App Router.

## Stack
- **Next.js 15** (App Router, `src/` dir, `@/*` alias)
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Zustand 5** — scroll state and zoom mode
- **Lucide-react** — icons

## Dev
```
npm run dev    # http://localhost:9999
npm run build  # production build (must pass before shipping)
```

## Key Architecture

**Year coordinate system** — internal integers from -4000 (4001 BC) to 2025 (2026 AD).
- Display: `year < 0` → `Math.abs(year) + " BC"`, `year >= 0` → `(year + 1) + " AD"`
- Implemented in `src/utils/yearUtils.ts:formatYear`

**Zoom modes** — three levels, px-per-year defined in `src/utils/constants.ts:PX_PER_YEAR`
- Centuries: 5px/yr | Decades: 50px/yr | Years: 500px/yr

**Virtualization** — only renders years in viewport + 5-year buffer. Logic in `src/utils/virtualization.ts:getVisibleRange`. DOM count stays under ~500 at all times.

**State** — `src/stores/timelineStore.ts`. Mode switching preserves `centerYear` by recalculating `scrollLeft` for the new scale.

## File Map
```
src/
  app/                          # Next.js App Router
  components/
    Timeline/
      TimelineContainer.tsx     # scroll host, virtualization loop
      TimelineTrack.tsx         # single horizontal lane
      YearBlock.tsx             # tick + label (React.memo)
      EventDot.tsx              # hover tooltip (Year mode only)
    Sidebar/
      Sidebar.tsx               # mode switcher, center year, jump-to-year
  stores/timelineStore.ts       # Zustand store
  utils/
    constants.ts                # YEAR_START, YEAR_END, PX_PER_YEAR, BUFFER
    yearUtils.ts                # formatYear, yearToPx, pxToYear, getTotalWidth
    virtualization.ts           # getVisibleRange()
  data/
    events.json                 # 7,000 seed events (stress test data)
    tracks.ts                   # track definitions
  types/index.ts                # ZoomMode, TimelineEvent, Track, VisibleRange
```

## Docs
Active project docs live in `docs/`:
- `docs/bugs/`      — known bugs and reproduction steps
- `docs/features/`  — planned features and specs
- `docs/plans/`     — implementation plans (PRD in `plans/PRD_v1.md`)

Before implementing a feature or fixing a bug, check the relevant doc file first.
