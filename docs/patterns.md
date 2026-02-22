# Patterns & Conventions

Recurring patterns to follow when adding or modifying features. Read this before writing new code.

---

## Navigating the Timeline Programmatically

**Always use `setPendingNav`** — never write `scrollLeft` directly from outside `TimelineContainer`.

```ts
// ✅ correct
useTimelineStore.getState().setPendingNav({ year: -44, zoom: 50 });

// ❌ wrong — bypasses the virtualization loop
useTimelineStore.setState({ scrollLeft: 200000 });
```

To fit a year range in view:
```ts
const { viewportWidth } = useTimelineStore.getState();
const midYear = Math.round((rangeStart + rangeEnd) / 2);
const fittingZoom = Math.max(MIN_PX_PER_YEAR, Math.min(MAX_PX_PER_YEAR,
  (viewportWidth * 0.75) / (rangeEnd - rangeStart + 1)
));
setPendingNav({ year: midYear, zoom: fittingZoom });
```
Reference: `src/components/Sidebar/Sidebar.tsx:handleApplyRange`

---

## Opening the Note Drawer

```ts
// New note at a year
useNotesStore.getState().openDrawer(year);

// Open an existing note
useNotesStore.getState().openDrawer(note.year, note.id);
```

The drawer reads `editingNoteId === null` to decide new vs edit mode.

---

## Timeline Colors

Always use the deterministic color helper — never hardcode a hex for a timeline lane:

```ts
import { getTimelineColor } from "@/utils/timelineColors";
const color = getTimelineColor(timelineIndex); // e.g. "#74A0FF"
```

Timeline index is the position in the `timelines` array from `notesStore`. Used for dot fill, accent stripe, tick glow, and active track highlight.

---

## Tailwind Color Usage

Use `no-*` tokens for all theme colors. Never use generic Tailwind colors (gray, blue, etc.) for UI chrome:

```tsx
// ✅
className="bg-no-card border-no-border text-no-muted"

// ❌
className="bg-gray-800 border-gray-600 text-gray-400"
```

For timeline color with opacity, use inline style — Tailwind can't interpolate dynamic values:
```tsx
style={{ background: `${color}1A` }}  // hex + 2-digit alpha
```

---

## Framer Motion Conventions

Ease arrays need a type cast to satisfy framer-motion's strict tuple type:

```ts
ease: [0.4, 0, 0.2, 1] as [number, number, number, number]
```

Use `INSTANT = { duration: 0 } as const` for zero-duration overrides (e.g. during panel resize).

Shared animation variants live inline in the component — don't create a separate variants file unless a pattern repeats in 3+ components.

---

## Adding a Store Selector in a Component

Prefer individual fine-grained selectors over selecting the whole store slice — this avoids unnecessary re-renders:

```ts
// ✅
const drawerOpen = useNotesStore((s) => s.drawerOpen);
const openDrawer = useNotesStore((s) => s.openDrawer);

// ❌ — re-renders on any store change
const store = useNotesStore();
```

For one-off reads outside React (e.g. in event handlers), use `.getState()`:
```ts
const { viewportWidth, pxPerYear } = useTimelineStore.getState();
```

---

## Confirm Dialogs (Destructive Actions)

Use the imperative `dialogStore` API — never use `window.confirm`:

```ts
const ok = await useDialogStore.getState().confirm({
  title: "Delete this note?",
  message: "This cannot be undone.",
  confirmLabel: "Delete",
  variant: "danger",
});
if (ok) deleteNote(id);
```

Reference: `src/stores/dialogStore.ts`, `src/components/ui/ConfirmDialog.tsx`

---

## Year Input Parsing

Users type years like `"500 BC"`, `"1066 AD"`, or `"-44"`. Use the module-level `parseYear` function already in `src/components/Sidebar/Sidebar.tsx` when adding any new year input. It handles BC/AD suffixes and clamps to `[YEAR_START, YEAR_END]`.

---

## Build Gate

Run `npm run build` before considering any task done. It runs TypeScript type-checking, which catches store/prop mismatches that `npm run dev` tolerates.

---

## What NOT to Do

- **Don't read `db` directly from components** — go through `notesStore` actions.
- **Don't add `font-sans`** — the app is intentionally mono-font throughout.
- **Don't hardcode z-index values** — check the z-index ladder in `docs/architecture.md` first.
- **Don't add new localStorage keys** without documenting them in `docs/architecture.md`.
- **Don't create a new utility file** for a function used in only one place — keep it co-located.
