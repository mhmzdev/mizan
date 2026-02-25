# Plan: Localization — English + Urdu

**Status:** draft — pending review before implementation

---

## Why

Mizan should be usable in Urdu for Pakistani and South Asian users who prefer their native language. Urdu is RTL (right-to-left); English is LTR. The two locales cover the primary expected user base.

---

## Scope

### In scope
- All static UI strings (labels, placeholders, button text, tooltips, section headings, empty states, error messages, toast messages, tour steps)
- RTL layout flip for Urdu (panel order, text alignment, icon mirroring where needed)
- Language persisted to `localStorage` and applied on mount without flash

### Out of scope
- Translating note content or timeline titles (user data — always stored as-is)
- Translating historical event titles in `events.json` (seed data — too large; stays English)
- URL-based locale (e.g. `/ur/...`) — no SSR routing needed; client-side only
- Plural rules beyond simple singular/plural

---

## Locale Details

| Locale | Code | Direction | Script |
|--------|------|-----------|--------|
| English | `en` | LTR | Latin |
| Urdu | `ur` | RTL | Nastaliq (Noto Nastaliq Urdu) |

---

## Font Strategy

Roboto Mono is Latin-only and will not render Urdu glyphs. We need a Nastaliq fallback loaded only when locale is `ur`.

**Proposed approach:**
- Load `Noto Nastaliq Urdu` via `next/font/google` alongside Roboto Mono in `layout.tsx`
- Apply it as a CSS variable (`--font-urdu`) on `<html>`
- In `globals.css`, when `html[dir="rtl"]`, set `font-family: var(--font-urdu), sans-serif` to override the mono default

This keeps the font download conditional — Roboto Mono users pay nothing extra.

---

## Architecture

### 1. Translation files

```
src/
  i18n/
    en.ts    # English strings (source of truth)
    ur.ts    # Urdu strings (mirrors en.ts shape exactly)
    index.ts # t() helper + useTranslation() hook
```

Each file exports a typed plain object — no JSON, so TypeScript checks key coverage at compile time.

```ts
// src/i18n/en.ts
export const en = {
  nav: {
    timeline: "Timeline",
    map: "Map",
  },
  notes: {
    newNote: "New Note",
    searchPlaceholder: "Search notes…",
    emptyState: "No notes yet. Click a year to add one.",
    deleteConfirmTitle: "Delete this note?",
    deleteConfirmMessage: "This cannot be undone.",
  },
  // ... all other keys
} as const;

export type Strings = typeof en;
```

```ts
// src/i18n/ur.ts — must satisfy Strings type
import type { Strings } from "./en";
export const ur: Strings = {
  nav: {
    timeline: "ٹائم لائن",
    map: "نقشہ",
  },
  // ...
};
```

### 2. `settingsStore` extension

Add `locale: "en" | "ur"` to `settingsStore` alongside `notation`. Persist to `localStorage` as `mizan_locale`. Default: `"en"`.

```ts
locale: "en" | "ur";
setLocale: (locale: "en" | "ur") => void;
```

### 3. `useTranslation()` hook

```ts
// src/i18n/index.ts
import { useSettingsStore } from "@/stores/settingsStore";
import { en } from "./en";
import { ur } from "./ur";

const STRINGS = { en, ur } as const;

export function useTranslation() {
  const locale = useSettingsStore((s) => s.locale);
  return STRINGS[locale];
}
```

Usage in components:
```tsx
const t = useTranslation();
<button>{t.notes.newNote}</button>
```

### 4. RTL layout

Set `dir` and `lang` attributes on `<html>` reactively. A thin hook handles this:

```ts
// src/hooks/useLocale.ts
export function useLocale() {
  const locale = useSettingsStore((s) => s.locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir  = locale === "ur" ? "rtl" : "ltr";
  }, [locale]);
}
```

Call `useLocale()` once inside the root layout component (alongside `useTheme()`).

Tailwind v4 has built-in RTL utilities (`rtl:` variant). Most layout will flip automatically via `dir="rtl"` since we already use flexbox. Specific overrides (e.g. panel order, icon transforms) use `rtl:` variants.

**Panel order:** The `[NotesPanel | drag | Timeline | drag | Sidebar]` row is `flex-row`. When `dir="rtl"` the browser reverses the visual order for free — no change needed.

**Icons that need mirroring:** Directional icons (chevrons, arrows) should be mirrored. Add `rtl:scale-x-[-1]` to those icon call sites.

### 5. Anti-flash inline script

The existing anti-flash script in `layout.tsx` reads `mizan_theme` before React hydrates. Extend it to also read `mizan_locale` and set `dir`/`lang` synchronously:

```html
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var theme  = localStorage.getItem('mizan_theme') || 'dark';
    var locale = localStorage.getItem('mizan_locale') || 'en';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.dir  = locale === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  })();
`}} />
```

### 6. Language switcher UI

Add a locale toggle to the right Sidebar alongside the notation switcher — two buttons: `EN` / `اردو`. Same pattern as the existing `NotationSwitcher`.

---

## String Inventory (categories)

These are the areas that need translated strings. Exact keys will be decided during implementation.

| Category | Examples |
|---|---|
| Navigation | Timeline, Map |
| Notes panel | New Note, Search notes…, empty state, unmapped count |
| Note drawer | Title, Year, Content, Location, Set location, Update location, Go to map, Save, Cancel, Delete, Link note, Unlink, broken link warning |
| Sidebar | Jump to year, Apply, Clear, Date range, From, To, Timelines, Add timeline, Rename, Delete |
| Header | (mostly icon-only; tooltips if any) |
| Confirm dialogs | Delete note?, Delete timeline?, Import data?, This cannot be undone |
| Toast messages | Note deleted, Undo, Timeline deleted, Saved |
| Tour overlay | All 5 tour step titles + descriptions |
| Error/empty states | No notes, No results, No location |
| Export/import dialog | Export, Import, Download, Select file, note count label |
| Map hints | Long press to add note |

---

## Implementation Order

1. **Scaffold i18n layer** — `src/i18n/en.ts`, `src/i18n/ur.ts`, `src/i18n/index.ts`, `useTranslation()` hook
2. **Extend settingsStore** — add `locale`, `setLocale`, `mizan_locale` persistence
3. **Anti-flash script** — extend to set `dir`/`lang` on `<html>` before paint
4. **`useLocale` hook** — reactive `dir`/`lang` on `<html>` for in-session locale changes
5. **Font loading** — add `Noto Nastaliq Urdu` in `layout.tsx`; apply via CSS when `dir="rtl"`
6. **Migrate strings** — component by component, replace hardcoded strings with `t.key.subkey`; start with the most visible areas (Notes panel → Drawer → Sidebar → Dialogs → Tour)
7. **RTL layout fixes** — audit flex/grid layouts; add `rtl:` overrides where browser default flip isn't enough
8. **Language switcher** — add to Sidebar below notation switcher
9. **QA** — switch locale, check every screen in both LTR and RTL; verify no hardcoded strings remain; verify font renders correctly in Urdu

---

## Open Questions

1. **Noto Nastaliq Urdu vs Noto Naskh Arabic** — Nastaliq is the authentic Urdu script style but renders at larger line heights. Naskh is more compact. Which do we prefer?
2. **Mixed-script content** — Note titles/content are user-typed. If a user types Urdu in a note while in `en` locale (or vice versa), the browser handles bidirectional text via Unicode BIDI algorithm. No action needed, but worth testing.
3. **Number rendering** — Urdu traditionally uses Eastern Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩). Should year display (`useFormatYear`) use these in `ur` locale, or keep Western Arabic (0-9) for consistency with the timeline coordinate system? Recommendation: keep Western Arabic — year integers are the core data model.
4. **Notation labels in Urdu** — BC/AD / BCE/CE stay as-is (they're abbreviations); BH/AH could display as ق ہ / ب ہ in Urdu. Decide during implementation.

---

## Risk Areas

- **Timeline ruler labels** (`YearBlock.tsx`) — rendered inside the virtualized canvas; currently mono font. In RTL the labels should still read LTR (year numbers are LTR regardless of locale). Use `dir="ltr"` on individual year label spans.
- **Panel resize logic** — drag handles in `page.tsx` use `clientX` delta. In RTL the panels visually flip but the drag delta math is the same — should be unaffected.
- **MapLibre** — the map itself is always LTR-agnostic (geographic canvas). Controls (zoom buttons, attribution) auto-position in RTL via MapLibre's own RTL support. The map tile labels (street names etc.) are outside our control.
