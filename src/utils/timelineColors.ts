/**
 * Per-timeline colors — CSS variable references so the palette can be
 * overridden per theme in globals.css without touching component code.
 */
export const TIMELINE_PALETTE = [
  "var(--t-color-0)", // blue  — Global History
  "var(--t-color-1)", // gold  — Personal (dark amber in light theme)
  "var(--t-color-2)", // rose
  "var(--t-color-3)", // teal
  "var(--t-color-4)", // amber
];

/** Active/selected dot color — white on dark, charcoal on light. */
export const ACTIVE_DOT_COLOR = "var(--active-dot-color)";

/** Returns the display color for a timeline based on its position index (0-based). */
export function getTimelineColor(index: number): string {
  return TIMELINE_PALETTE[index % TIMELINE_PALETTE.length];
}

/**
 * Returns a color with the given opacity percentage using color-mix().
 * Works with CSS variable color references (e.g. "var(--t-color-0)").
 * Replaces the old hex-alpha concatenation pattern (e.g. `${color}B3`).
 *
 * @param color   Any CSS color value, including var() references
 * @param percent 0–100 opacity percentage (e.g. 70 for 70% opacity)
 */
export function alphaColor(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
