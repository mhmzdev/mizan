# Feature Specs

One file per feature. Write the spec before implementation — it forces clarity and gives the AI a reference.

## Naming convention
`short-feature-name.md`

## Template
```
## Feature: <title>
**Status:** planned | in-progress | shipped

### Why
(user problem this solves)

### What
(behaviour from the user's perspective — no implementation details)

### Acceptance Criteria
- [ ] criterion one
- [ ] criterion two

### Out of Scope
- thing we are NOT doing
```

---

## Shipped Features

| Feature | Notes |
|---|---|
| Horizontal timeline scroll | Virtualized, 60fps, 4001 BC–2026 AD |
| Continuous zoom | Smooth float `pxPerYear`; CMD/Alt+scroll; sidebar buttons |
| Notes system | Create / edit / delete notes anchored to a year |
| Multiple timelines | Up to 5 named timelines; per-timeline dot colors and track highlight |
| Notes panel | Left sidebar: list, search, range filter |
| Note drawer | Slide-in editor (desktop) / full-screen (mobile) |
| URL deep linking | `?year=&zoom=`, `?note=`, `?range_from=&range_to=` |
| Persistent last view | Position + range restored from localStorage on reload |
| Date range filter | Dim overlay + note filtering; auto-navigates to fit range |
| Collapsible panels | Both sidebars collapse; state persisted |
| Resizable panels | Drag handles; width persisted to localStorage |
| Mobile layout | Tab navigation + bottom sheet; full-screen drawer |
| Nordic Obsidian theme | Dark `no-*` token system via Tailwind v4 `@theme` |
| End-of-timeline markers | Visual boundary at 4001 BC and 2026 AD |
| Active timeline glow | Tick marks glow in timeline color when drawer is open |
| Loading screen | Blocks UI until initial IndexedDB data is loaded |
| Histography layer | 7 000 seed events visualized as `EventDot`s (years mode only) |
| Global event annotation | Open drawer from an `EventDot`; note hides the event dot once saved |
| Notes panel search | Searches note titles/content + global event titles; highlights matches |
| Year notation switcher | Per-user BC/AD · BCE/CE · BH/AH (Hijri); persisted to `mizan_notation` |
| Note linking | Bidirectional note ↔ note link; linked pair shown as interval overlay on timeline |
| Timeline show/hide | Toggle visibility of a timeline lane without deleting it |
| Export / Import | Full JSON snapshot of all notes + timelines; `HardDrive` button in header |
| Undo delete | Toast after deleting a note or timeline; action reverts within the same session |
| Map view | MapLibre GL canvas toggled via Globe button; MapTiler tiles via `NEXT_PUBLIC_MAPTILER_KEY` (falls back to CARTO); pins for notes + events; long-press to create note; tap pin to edit; location pick mode; theme-reactive |
| Map time slider | Full-width glassmorphism bar at map bottom; two drag handles resize window; center drag pans without resizing; drives visible pin filter independent of timeline sidebar range; persisted to `mizan_map_range` + URL `map_range_from/to` |
| Onboarding tours | Main timeline tour (3 steps, first visit); map tour (2 steps, first map visit) — spotlight overlay; persisted completion flags |
| Favicon | SVG `src/app/icon.svg` auto-served by Next.js App Router; Mizan logo adapted (three lanes + glowing tick on dark rounded background) |
| Historical map | OHM tiles (OpenHistoricalMap) via "Historical" toggle button; amber handle on TimeSlider sets the filter year; `applyOHMDateFilter` walks all vector tile layers with `start_decdate`/`end_decdate` expressions; CSS filter dims OHM to match dark theme; persisted to `mizan_history_mode`/`mizan_history_year` + URL `history`/`history_year` |
