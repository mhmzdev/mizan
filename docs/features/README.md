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
