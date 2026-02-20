import { create } from "zustand";
import { ZoomMode } from "@/types";
import { PX_PER_YEAR, YEAR_START } from "@/utils/constants";

interface TimelineState {
  mode: ZoomMode;
  scrollLeft: number;
  viewportWidth: number;
  centerYear: number;

  setMode: (mode: ZoomMode) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setViewportWidth: (width: number) => void;
}

/**
 * Compute the center year from scroll position and viewport width.
 */
function computeCenterYear(
  scrollLeft: number,
  viewportWidth: number,
  mode: ZoomMode
): number {
  const centerPx = scrollLeft + viewportWidth / 2;
  return Math.floor(centerPx / PX_PER_YEAR[mode]) + YEAR_START;
}

/**
 * Compute scrollLeft that centers a given year for a given mode and viewport.
 */
function centerYearToScrollLeft(
  year: number,
  viewportWidth: number,
  mode: ZoomMode
): number {
  const yearPx = (year - YEAR_START) * PX_PER_YEAR[mode];
  return yearPx - viewportWidth / 2;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  mode: "centuries",
  scrollLeft: 0,
  viewportWidth: 0,
  centerYear: YEAR_START,

  setMode: (newMode: ZoomMode) => {
    const { scrollLeft, viewportWidth, mode } = get();
    const center = computeCenterYear(scrollLeft, viewportWidth, mode);
    const newScrollLeft = centerYearToScrollLeft(
      center,
      viewportWidth,
      newMode
    );
    set({
      mode: newMode,
      centerYear: center,
      scrollLeft: Math.max(0, newScrollLeft),
    });
  },

  setScrollLeft: (scrollLeft: number) => {
    const { viewportWidth, mode } = get();
    const center = computeCenterYear(scrollLeft, viewportWidth, mode);
    set({ scrollLeft, centerYear: center });
  },

  setViewportWidth: (width: number) => {
    set({ viewportWidth: width });
  },
}));
