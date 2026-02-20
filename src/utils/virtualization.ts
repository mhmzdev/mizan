import { ZoomMode, VisibleRange } from "@/types";
import { YEAR_START, YEAR_END, BUFFER } from "./constants";
import { pxToYear } from "./yearUtils";

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
