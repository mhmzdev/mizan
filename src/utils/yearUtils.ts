import { ZoomMode, YearNotation } from "@/types";
import { PX_PER_YEAR, YEAR_START, YEAR_END } from "./constants";

/**
 * Convert internal year to astronomical CE year.
 * internal 0 → 1 CE, internal -1 → 0 CE (= 1 BC), internal -2 → -1 CE (= 2 BC).
 */
function toAstronomicalCE(year: number): number {
  return year + 1;
}

/** Format internal year as Hijri (AH/BH). 1 AH ≈ 622 CE. */
function formatHijri(year: number): string {
  const ce = toAstronomicalCE(year);
  if (ce >= 622) {
    const ah = Math.round((ce - 622) * 1.030684) + 1;
    return `${ah} AH`;
  }
  const bh = Math.max(1, Math.round((622 - ce) * 1.030684));
  return `${bh} BH`;
}

/**
 * Format a continuous integer year for display.
 * year < 0  → "|year| BC" / "|year| BCE" / "X BH"
 * year >= 0 → "(year+1) AD" / "(year+1) CE" / "X AH"
 *
 * Internally -1 = 1 BC, 0 = 1 AD (no year zero).
 */
export function formatYear(year: number, notation: YearNotation = "BC/AD"): string {
  if (notation === "BCE/CE") {
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year + 1} CE`;
  }
  if (notation === "BH/AH") {
    return formatHijri(year);
  }
  if (year < 0) return `${Math.abs(year)} BC`;
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
    case "overview":
      return 1000;
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
    case "overview":
      return 500;
    case "centuries":
      return 50;
    case "decades":
      return 5;
    case "years":
      return 1;
  }
}

/** Derive a named zoom mode from the live pxPerYear value. */
export function getModeFromPxPerYear(pxPerYear: number): ZoomMode {
  if (pxPerYear >= 100) return "years";
  if (pxPerYear >= 10) return "decades";
  if (pxPerYear >= 1) return "centuries";
  return "overview";
}

/** Continuous label interval based on live pxPerYear float. */
export function getLabelIntervalFromPx(pxPerYear: number): number {
  if (pxPerYear >= 100) return 1;
  if (pxPerYear >= 10) return 10;
  if (pxPerYear >= 1) return 100;
  return 1000;
}

/** Continuous tick interval based on live pxPerYear float. */
export function getTickIntervalFromPx(pxPerYear: number): number {
  if (pxPerYear >= 100) return 1;
  if (pxPerYear >= 10) return 5;
  if (pxPerYear >= 1) return 50;
  return 500;
}

/** Convert a pixel offset to a year using a continuous pxPerYear float. */
export function pxToYearContinuous(px: number, pxPerYear: number): number {
  return Math.floor(px / pxPerYear) + YEAR_START;
}
