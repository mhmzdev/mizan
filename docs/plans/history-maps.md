# Plan: Historical Map View (OpenHistoricalMap Integration)

**Status:** draft — pending review before implementation

---

## Why

The map view currently shows a modern basemap (OpenFreeMap / Protomaps). When a user is looking at notes from 44 BC or 1453 AD, they want to see the world *as it looked then* — political boundaries, civilizations, trade routes — not today's borders. OpenHistoricalMap (OHM) provides vector tiles for this, filtered client-side to any year.

---

## UX Summary

A single draggable vertical line handle appears **on the existing TimeSlider bar**, between the two range handles. It is visually distinct (gold/amber, diamond head). A year label floats above it. When the user drags it, the map tiles update live to show the historical world at that year.

A toggle button (e.g. a `Clock` or `History` icon) in the map overlay controls enables/disables "history mode". When off, the modern basemap (current behavior) is used and the third handle is hidden. When on, the OHM style is loaded and the handle is shown.

```
  [2327 BC]              [500 BC ◆]                    [436 AD]
  ╔═════════▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒════════╗
  ║ ◀ range start         history year handle   range end ▶ ║
  ╚═══════════════════════════════════════════════════════════╝
```

---

## OpenHistoricalMap API — Key Facts

| Fact | Detail |
|------|--------|
| Tile format | Vector tiles only (PBF/MVT) — no raster PNG tiles |
| Style JSON | `https://www.openhistoricalmap.org/map-styles/main/main.json` (MapLibre-compatible) |
| Year filtering | Client-side via `@openhistoricalmap/maplibre-gl-dates` npm package |
| API call | `map.filterByDate("0044")` — called after `styledata` event |
| Date format | ISO 8601-like string: `"0001"` = 1 AD, `"0000"` = 1 BC, `"-0043"` = 44 BC |
| API key | None required |
| Rate limit | None documented (fair-use, community server) |
| Data coverage | Sparse before medieval period; good for documented civilizations |
| Earliest data | Supports back to 4001 BC (matches our `YEAR_START`) |

### Year Conversion: Mizan → OHM

OHM uses ISO 8601 astronomical year numbering (year `0` = 1 BC, year `-1` = 2 BC, etc.):

```ts
function mizanYearToOHM(year: number): string {
  // Mizan: 0 = 1 AD, -1 = 1 BC, -44 = 44 BC
  // OHM:   "0001" = 1 AD, "0000" = 1 BC, "-0043" = 44 BC
  const astronomical = year >= 0 ? year + 1 : year + 1; // +1 shifts AD; BC naturally aligns
  if (astronomical >= 0) {
    return String(astronomical).padStart(4, "0");
  } else {
    return "-" + String(Math.abs(astronomical)).padStart(4, "0");
  }
}

// Examples:
// mizanYearToOHM(0)   → "0001"  (1 AD)
// mizanYearToOHM(-1)  → "0000"  (1 BC)
// mizanYearToOHM(-44) → "-0043" (44 BC)
// mizanYearToOHM(999) → "1000"  (1000 AD)
```

> **Verify this during implementation** by testing `map.filterByDate()` against known historical features (e.g. Roman Empire extent at 44 BC).

---

## Architecture

### 1. New state in `mapStore`

```ts
// mapStore additions
historyMode:  boolean;           // false = modern map, true = OHM tiles active
historyYear:  number;            // year the OHM handle is at (default: midpoint of current range)
setHistoryMode: (on: boolean) => void;
setHistoryYear: (year: number) => void;
```

- `historyMode` persisted to `localStorage` key `mizan_history_mode` (`"1"` / `"0"`)
- `historyYear` persisted to `localStorage` key `mizan_history_year` (integer)
- Both added to URL params: `history=1&history_year=-44`
- Defaults: `historyMode = false`, `historyYear = 0` (1 AD)

### 2. New npm dependency

```bash
npm install @openhistoricalmap/maplibre-gl-dates
```

This adds `map.filterByDate(dateString)` to the MapLibre map instance.

### 3. MapView.tsx changes

**Style selection:**
```ts
function getMapStyle(theme: string, historyMode: boolean): string {
  if (historyMode) {
    return "https://www.openhistoricalmap.org/map-styles/main/main.json";
  }
  // existing logic: Protomaps / OpenFreeMap / CARTO fallback
  return getModernStyle(theme);
}
```

When `historyMode` toggles:
- Call `map.setStyle(newStyleUrl)` (same pattern as existing theme switching)
- On `styledata`: call `map.filterByDate(mizanYearToOHM(historyYear))`
- Re-add GeoJSON sources and layers for user notes/events pins (same pattern as existing theme switch)

When `historyYear` changes (while `historyMode` is already on):
- Just call `map.filterByDate(mizanYearToOHM(historyYear))` — no style reload needed

**Note pins on OHM tiles:**
User note/event pins still render on top of the OHM basemap (GeoJSON layers are re-added after style load). No change to pin logic.

**Toggle button:**
Add a small button in the map overlay controls (bottom-left corner or alongside the zoom controls). Uses a `History` or `Globe` icon. Active state = amber/gold color to visually signal history mode is on.

```tsx
<button
  onClick={() => setHistoryMode(!historyMode)}
  className={cn(
    "map-control-btn",
    historyMode && "text-amber-400 bg-amber-400/10 border-amber-400/30"
  )}
  title="Toggle historical map"
>
  <History size={16} />
</button>
```

When turning history mode **on**: if `historyYear` is outside `[mapRangeStart, mapRangeEnd]`, snap it to the midpoint of the current range.

### 4. TimeSlider.tsx changes

Add a third drag handle only when `historyMode` is true:

```tsx
// New state from mapStore
const historyMode = useMapStore((s) => s.historyMode);
const historyYear = useMapStore((s) => s.historyYear);
const setHistoryYear = useMapStore((s) => s.setHistoryYear);

// Extend DragMode type
type DragMode = "left" | "right" | "center" | "history" | null;
```

**Visual design of the history handle:**
- Thinner vertical line: `w-[2px] h-7 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]`
- A small diamond/circle head at top to make it grabable
- Year label floats above it, styled in amber (distinct from the blue range labels)
- `z-index: 15` — above the center region (z-5) but below the range thumbs (z-10)... actually above range thumbs since it needs to be grabable

**Handle positioning:**
```tsx
const historyPct = yearToPercent(historyYear);
```

**Pointer handling:**
Same `setPointerCapture` pattern as existing thumbs. On move, clamp within `[YEAR_START, YEAR_END]` and call `setHistoryYear(year)`.

**Year label:**
- Shows above the handle, styled differently from range labels (amber border, amber text)
- Must not collide with range labels — consider hiding it if too close to either range label (< 5% distance)

### 5. `useUrlSync.ts` changes

```ts
// New params read/write
params.set("history",      historyMode ? "1" : "0");
params.set("history_year", String(historyYear));
```

### 6. `src/utils/yearUtils.ts` — new export

```ts
export function mizanYearToOHM(year: number): string {
  const astronomical = year + 1; // Mizan 0 = 1 AD = astronomical 1
  if (astronomical >= 0) return String(astronomical).padStart(4, "0");
  return "-" + String(Math.abs(astronomical)).padStart(4, "0");
}
```

---

## Interaction Design

| Action | Result |
|--------|--------|
| Click history toggle (off → on) | Load OHM style, show history handle at midpoint of range, filter map to that year |
| Click history toggle (on → off) | Restore modern style (Protomaps/OpenFreeMap), hide history handle |
| Drag history handle | Update `historyYear` live; `filterByDate()` called on each change (debounce 150ms to avoid flooding) |
| Drag range handles | Range changes as normal; history handle stays at its year (does not auto-snap to range) |
| Drag range handle past history handle | History handle is not constrained by range — the two are independent |
| Switch theme (dark/light) | If history mode on: reload OHM style (no theme variant for OHM — always uses its own palette) |
| Tap note pin outside range | Existing behavior: range window shifts. History year: unchanged |

---

## Limitations / Edge Cases

**Sparse data in ancient dates:** OHM has very little data before ~1000 AD outside major civilizations. When `historyYear` is far in the past, the map may appear nearly empty. No special handling needed — this is expected behavior.

**No dark theme for OHM:** OHM's `main.json` style is a light historical map. It will contrast with Mizan's dark UI. Options:
- Accept the contrast (history mode is a distinct "mode", a different visual world is OK)
- Long-term: use the `woodblock` style for a more neutral look

**Label collision:** The three year labels (range start, range end, history year) can overlap if the window is small. Handle this by:
1. Hiding the history label if within 4% of either range label
2. Or: use a fixed position above the center of the bar for the history label

**Performance:** `filterByDate()` is synchronous and cheap — it modifies layer filter expressions in MapLibre's style. No network request is made per year change. The 150ms debounce on drag is purely to avoid excessive React renders.

**`maplibre-gl-dates` and MapLibre v5:** The package targets MapLibre GL v2/v3. Verify it works with v5 (the current installed version). If not, the filter expressions can be applied manually — the pattern is straightforward:
```ts
map.setFilter("layer-id", [
  "all",
  existingFilter,
  ["<=", ["get", "start_decdate"], decimalYear],
  ["any",
    ["!", ["has", "end_decdate"]],
    [">=", ["get", "end_decdate"], decimalYear],
  ],
]);
```
A utility to walk all layers and apply this is ~30 lines.

---

## Implementation Order

1. **`mizanYearToOHM`** — add to `src/utils/yearUtils.ts`; write a few test cases inline as comments
2. **`mapStore`** — add `historyMode`, `historyYear`, `setHistoryMode`, `setHistoryYear`; wire localStorage + `mizan_history_mode` / `mizan_history_year`
3. **Install dependency** — `npm install @openhistoricalmap/maplibre-gl-dates`; verify MapLibre v5 compatibility
4. **MapView** — add `getMapStyle()` logic; handle `historyMode` toggle (style switch + re-add GeoJSON layers); add toggle button UI; call `filterByDate` on `styledata` when `historyMode` is on; call `filterByDate` when `historyYear` changes (debounced)
5. **TimeSlider** — add `"history"` drag mode; render amber handle + label conditionally when `historyMode`; handle pointer events
6. **`useUrlSync`** — add `history` and `history_year` params
7. **QA** — test year conversion edge cases (1 AD, 1 BC, 44 BC, 500 AD); test style switch with notes pins; test label collision; test persistence across reload

---

## Open Questions

1. **OHM style theme:** OHM's `main.json` is light-toned. Should we accept this (history mode = visually distinct mode) or investigate a dark style? The `woodblock` style is warmer/parchment-toned.
2. **History handle vs range:** Should the history handle be constrained to stay within the range window? Or free to go anywhere on the full timeline? Current plan: free, since the map filter (range) and map view year (history) are conceptually independent.
3. **Auto-follow:** When the user drags the range window (center drag), should the history handle follow along to stay centered in the window? Or stay fixed? Recommendation: stay fixed, keep behavior simple.
4. **MapLibre v5 compatibility of `maplibre-gl-dates`:** Must be verified before committing to the package. If incompatible, manual filter walking is the fallback (not complex, ~30 lines).
