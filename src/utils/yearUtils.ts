import { ZoomMode } from "@/types";
import { PX_PER_YEAR, YEAR_START, YEAR_END } from "./constants";

/**
 * Format a continuous integer year for display.
 * year < 0  → "|year| BC"
 * year >= 0 → "(year+1) AD"
 *
 * Internally -1 = 1 BC, 0 = 1 AD (no year zero).
 */
export function formatYear(year: number): string {
  if (year < 0) {
    return `${Math.abs(year)} BC`;
  }
  return `${year + 1} AD`;
}

/** Convert a pixel offset (from left edge of the spacer) to a year. */
export function pxToYear(px: number, mode: ZoomMode): number {
  return Math.floor(px / PX_PER_YEAR[mode]) + YEAR_START;
}

/** Convert a year to its pixel offset from the left edge. */
export function yearToPx(year: number, mode: ZoomMode): number {
  return (year - YEAR_START) * PX_PER_YEAR[mode];
}

/** Get the total width of the timeline spacer in pixels. */
export function getTotalWidth(mode: ZoomMode): number {
  return (YEAR_END - YEAR_START + 1) * PX_PER_YEAR[mode];
}

/** Determine label interval based on zoom mode. */
export function getLabelInterval(mode: ZoomMode): number {
  switch (mode) {
    case "centuries":
      return 100;
    case "decades":
      return 10;
    case "years":
      return 1;
  }
}

/** Determine tick interval (minor ticks between labels). */
export function getTickInterval(mode: ZoomMode): number {
  switch (mode) {
    case "centuries":
      return 50;
    case "decades":
      return 5;
    case "years":
      return 1;
  }
}
