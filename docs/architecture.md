# Architecture Reference

Detailed technical reference. Consult this when working on rendering, state, persistence, or layout.

---

## File Map

```
src/
  app/
    page.tsx                   # Root layout: collapsible panels, drag-resize handles, mobile sheet
    layout.tsx                 # Font loading (Roboto Mono), <html> metadata
    globals.css                # @theme tokens, base font-size (18px), scrollbar styles

  components/
    Timeline/
      TimelineContainer.tsx    # Scroll host, virtualization loop, zoom animation (rAF), range overlays, boundary markers
      TimelineTrack.tsx        # Single horizontal lane; renders YearBlocks + NoteDots + EventDots
      YearBlock.tsx            # One year's tick mark + label — React.memo, receives pxPerYear float
      NoteDot.tsx              # Hover tooltip for a user note; pulse animation when active
      EventDot.tsx             # Hover tooltip for a seed event (years mode only)
    Map/
      MapView.tsx              # MapLibre GL canvas; GeoJSON circle layer; preview pin; range + theme reactive
    Notes/
      NotesPanel.tsx           # Left panel: note list, search bar, range filter badge, unmapped count
      NoteCard.tsx             # Single row in the note list
      NoteDrawer.tsx           # Slide-in editor (create / edit notes); full-screen on mobile
    Sidebar/
      Sidebar.tsx              # Right panel: center year, jump-to-year, date range, timelines manager
      ModeButton.tsx           # Individual zoom mode button
    ui/
      ConfirmDialog.tsx        # Generic destructive-action confirmation modal
      ExportImportDialog.tsx   # Export/import notes + timelines as JSON (HardDrive button in header)

  stores/
    timelineStore.ts           # Viewport state — see "Stores" below
    notesStore.ts              # Notes + timelines CRUD + drawer state — see "Stores" below
    dialogStore.ts             # Confirm dialog (imperative API: await confirm({...}))
    settingsStore.ts           # User preferences (notation) — persisted to localStorage
    mapStore.ts                # Map view state (viewMode, mapCenter, mapZoom, drawerPreviewPin) — see "Stores" below

  hooks/
    useUrlSync.ts              # URL ↔ store sync; debounced writes + localStorage persistence
    useTheme.ts                # useTheme() hook — toggles data-theme on <html>, persists to mizan_theme
    useFormatYear.ts           # useFormatYear() — returns formatYear bound to current notation setting

  lib/
    db.ts                      # Dexie schema (tables: notes, timelines)

  utils/
    constants.ts               # YEAR_START, YEAR_END, PX_PER_YEAR map, MIN/MAX_PX_PER_YEAR, BUFFER
    yearUtils.ts               # formatYear, yearToPx, pxToYear, getTotalWidth
    virtualization.ts          # getVisibleRange() — core windowing logic
    timelineColors.ts          # getTimelineColor(index) — deterministic hex per timeline slot

  data/
    events.json                # 7,000 seed historical events (stress-test data)
    tracks.ts                  # Track definitions (global / personal)

  types/index.ts               # ZoomMode, Note, Timeline, TimelineEvent, Track, VisibleRange
```

---

## Stores

### `timelineStore` (`src/stores/timelineStore.ts`)

| Field | Type | Purpose |
|---|---|---|
| `pxPerYear` | `number` | Live zoom — the single source of zoom truth |
| `scrollLeft` | `number` | Current scroll offset in px |
| `viewportWidth` | `number` | Container width in px |
| `centerYear` | `number` | Derived: `floor((scrollLeft + vw/2) / pxPerYear) + YEAR_START` |
| `pendingNav` | `{ year, zoom } \| null` | Command channel — consumed by `TimelineContainer` for instant jumps |
| `targetPxPerYear` | `number \| null` | Triggers animated zoom transition |
| `rangeStart` | `number \| null` | Active date range filter start |
| `rangeEnd` | `number \| null` | Active date range filter end |
| `activeInterval` | `{ start: number; end: number } \| null` | Interval overlay shown when a linked note pair is open |

Key actions: `setPxPerYear`, `setScrollLeft`, `setPendingNav`, `setRange`, `clearRange`, `setActiveInterval`.

### `notesStore` (`src/stores/notesStore.ts`)

| Field | Type | Purpose |
|---|---|---|
| `notes` | `Note[]` | All user notes, ordered by year |
| `timelines` | `Timeline[]` | All timelines, ordered by `createdAt` |
| `drawerOpen` | `boolean` | Whether NoteDrawer is visible |
| `editingNoteId` | `number \| null` | `null` = new note mode |
| `selectedYear` | `number` | Year passed to `openDrawer()` |
| `lastTimelineId` | `number` | Last timeline used in the drawer |
| `drawerTimelineId` | `number \| null` | Timeline selected inside the open drawer (drives track highlight) |
| `pendingTitle` | `string` | Pre-filled title when opening drawer from a global event dot |
| `pendingSourceEvent` | `TimelineEvent \| null` | Full event object when opening from a global event (annotation mode) |
| `pendingDelete` | `PendingDelete \| null` | Stashed note/timeline for undo toast; `null` = nothing pending |

Key actions: `openDrawer(year, noteId?, title?, sourceEvent?)`, `closeDrawer()`, `saveNote`, `updateNote`, `deleteNote`, `loadNotes`, `loadTimelines`, `addTimeline`, `renameTimeline`, `deleteTimeline`, `toggleTimelineHidden`, `linkNotes`, `unlinkNotes`, `clearBrokenLink`, `importData`, `undoDelete`, `commitDelete`.

### `mapStore` (`src/stores/mapStore.ts`)

| Field | Type | Purpose |
|---|---|---|
| `viewMode` | `"timeline" \| "map"` | Which center panel is shown |
| `mapCenter` | `{ lat: number; lng: number }` | Last map center (default: Levant 32°N 35°E) |
| `mapZoom` | `number` | Last map zoom level (default: 4) |
| `drawerPreviewPin` | `{ lat, lng, noteId } \| null` | Temporary marker shown while NoteDrawer has unsaved coords |

Key actions: `setViewMode`, `setMapCenter`, `setMapZoom`, `setDrawerPreviewPin`.
`viewMode`, `mapCenter`, `mapZoom` are persisted to localStorage. `drawerPreviewPin` is always `null` on mount.

---

## Rendering Pipeline

```
page.tsx
  └── TimelineContainer          ← scroll events, rAF zoom loop, pendingNav consumer
        └── TimelineTrack[]       ← one per timeline (Zustand timelines array)
              ├── YearBlock[]     ← virtualized, only visible years rendered
              ├── NoteDot[]       ← notes matching this track's timelineId
              └── EventDot[]      ← seed events (years mode only)
```

**Virtualization** — `getVisibleRange(scrollLeft, viewportWidth, pxPerYear)` returns `{ startYear, endYear }`. Only years in that window + `BUFFER` (5) are mounted. DOM node count stays below ~500 at all times.

**Zoom animation** — `pendingNav` triggers an instant scroll reposition without animation. Smooth zoom transitions go through `targetPxPerYear`, which `TimelineContainer` interpolates via `requestAnimationFrame`.

---

## Persistence Layers

### IndexedDB (Dexie — `src/lib/db.ts`)
- `timelines` table: `{ id, title, isDefault, eventTrack?, hidden?, createdAt }` — schema v2+
- `notes` table: `{ id, timelineId, year, title, content, sourceEventId?, linkedNoteId?, lat?, lng?, locationAccuracy?, createdAt, updatedAt }` — schema v5 (indexed: `year, timelineId, sourceEventId, linkedNoteId`; `lat`/`lng`/`locationAccuracy` are optional, not indexed)

### localStorage
| Key | Value |
|---|---|
| `mizan_last_view` | `{ year, zoom, rangeFrom?, rangeTo? }` |
| `mizan_notes_width` | Panel width in px (number) |
| `mizan_sidebar_width` | Panel width in px (number) |
| `mizan_last_timeline_id` | Last selected timeline id (number) |
| `mizan_theme` | `"dark"` or `"light"` (string) |
| `mizan_notation` | `"BC/AD"` \| `"BCE/CE"` \| `"BH/AH"` — year display notation |
| `mizan_view_mode` | `"timeline"` \| `"map"` — last active center panel |
| `mizan_map_center` | `{ lat, lng }` JSON — last map camera center |
| `mizan_map_zoom` | Float — last map zoom level |

### URL params
| Param | Meaning |
|---|---|
| `year` | Center year (integer) |
| `zoom` | `pxPerYear` (float) |
| `note` | Note id — deep link, opens that note directly |
| `range_from` | Range filter start year |
| `range_to` | Range filter end year |

`useUrlSync` debounces writes at 350 ms and reads on mount (priority: URL > localStorage).

---

## Theme System

Tailwind v4 `@theme` in `globals.css` exposes `no-*` color tokens:

| Token | Hex | Role |
|---|---|---|
| `no-bg` | `#1A1C1E` | Page background |
| `no-panel` | `#1F2226` | Sidebar / panel backgrounds |
| `no-card` | `#252A30` | Cards, inputs, list items |
| `no-border` | `#2F3337` | Dividers and borders |
| `no-text` | `#E1E2E5` | Primary text |
| `no-muted` | `#6C7380` | Secondary / disabled text |
| `no-blue` | `#74A0FF` | Accent — interactive elements |
| `no-gold` | `#FFD700` | Gold accent (note year labels) |

Base font-size is `18px` on `html`. All `rem`-based Tailwind sizes scale from this.

### Theme Switching

`src/hooks/useTheme.ts` — `useTheme()` hook returns `{ theme, toggleTheme }`. Sets `data-theme` attribute on `<html>`. The anti-flash inline script in `layout.tsx` reads `mizan_theme` before first paint.

**Per-timeline palette** lives as CSS variables `--t-color-0` through `--t-color-4` in `:root` (dark defaults) and `html[data-theme="light"]` (light overrides). Components never reference hex values directly — they use `getTimelineColor(index)` which returns `"var(--t-color-N)"`.

**`alphaColor(color, percent)`** in `src/utils/timelineColors.ts` — use this instead of hex alpha concatenation (e.g. `${color}B3`). Uses `color-mix()` so it works with CSS variable color references.

**Active dot** uses `var(--active-dot-color)` — white on dark, deep charcoal on light. The `dot-pulse` animation glow uses `var(--dot-pulse-color)` via `color-mix()` in the keyframe.

---

## Z-Index Ladder

| Layer | z-index | Element |
|---|---|---|
| Timeline content | 0–19 | YearBlocks, tracks |
| Boundary markers | 20 | Start / end of timeline labels |
| Range overlays | 21 | Dim overlay outside date range |
| Range boundary lines | 22 | Blue edge lines at range limits |
| Drag handles | 25 | Panel resize handles |
| Note dots | 40 | NoteDot / EventDot components |
| Timeline cursor | 45 | Hairline cursor on hover |
| Header | 50 | Top app bar |
| Desktop NoteDrawer | 55 | Slide-in note editor |
| Mobile sheet | 60 | Bottom sheet (notes / sidebar) |
| Mobile NoteDrawer | 70 | Full-screen note editor on mobile |

---

## Panel Layout (`page.tsx`)

Desktop: `[NotesPanel | drag] [TimelineContainer] [drag | Sidebar]`
- Notes panel: collapsible left, min `208px`, max `400px`, persisted to `mizan_notes_width`
- Sidebar: collapsible right, same bounds, persisted to `mizan_sidebar_width`
- Resize via `document.addEventListener("mousemove/mouseup")` closures; `isResizingRef` disables transition during drag

Mobile: tabs (`notes` | `timeline` | `sidebar`) + bottom bar; NoteDrawer renders full-screen (`fixed inset-0 z-[70]`).
