/**
 * Per-timeline dot colors.
 * Index 0 → timeline id=1 (Global History) → blue
 * Index 1 → timeline id=2 (Personal Study Notes) → gold
 * Index 2-4 → user-created timelines → rose / teal / orange
 */
export const TIMELINE_PALETTE = [
  "#74A0FF", // blue  — Global History
  "#FFD700", // gold  — Personal Study Notes
  "#FF6B9D", // rose  — custom slot 3
  "#4ECCA3", // teal  — custom slot 4
  "#FF9F43", // amber — custom slot 5
];

/** The one universal color for the currently selected/active dot. */
export const ACTIVE_DOT_COLOR = "#FFFFFF";

/** Returns the display color for a timeline based on its position index (0-based). */
export function getTimelineColor(index: number): string {
  return TIMELINE_PALETTE[index % TIMELINE_PALETTE.length];
}
