import { ZoomMode, VisibleRange } from "@/types";
import { YEAR_START, YEAR_END, BUFFER } from "./constants";
import { pxToYear, pxToYearContinuous } from "./yearUtils";

/**
 * Compute the range of years that should be rendered,
 * based on current scroll position and viewport width.
 * Includes BUFFER years on each side.
 */
export function getVisibleRange(
  scrollLeft: number,
  viewportWidth: number,
  mode: ZoomMode
): VisibleRange {
  const rawStart = pxToYear(scrollLeft, mode) - BUFFER;
  const rawEnd = pxToYear(scrollLeft + viewportWidth, mode) + BUFFER;

  return {
    startYear: Math.max(rawStart, YEAR_START),
    endYear: Math.min(rawEnd, YEAR_END),
  };
}

/**
 * Continuous version: uses a live pxPerYear float for use during animation.
 * Includes BUFFER years on each side.
 */
export function getVisibleRangeFromPx(
  scrollLeft: number,
  viewportWidth: number,
  pxPerYear: number
): VisibleRange {
  const rawStart = pxToYearContinuous(scrollLeft, pxPerYear) - BUFFER;
  const rawEnd = pxToYearContinuous(scrollLeft + viewportWidth, pxPerYear) + BUFFER;

  return {
    startYear: Math.max(rawStart, YEAR_START),
    endYear: Math.min(rawEnd, YEAR_END),
  };
}
