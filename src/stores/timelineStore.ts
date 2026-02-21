import { create } from "zustand";
import { PX_PER_YEAR, YEAR_START, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR } from "@/utils/constants";

interface TimelineState {
  pxPerYear: number;       // live zoom value — the single source of zoom truth
  scrollLeft: number;
  viewportWidth: number;
  centerYear: number;
  targetPxPerYear: number | null; // set by sidebar to trigger an animated transition

  setPxPerYear: (pxPerYear: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setViewportWidth: (width: number) => void;
  setTargetPxPerYear: (px: number | null) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  pxPerYear: PX_PER_YEAR.centuries,
  scrollLeft: 0,
  viewportWidth: 0,
  centerYear: YEAR_START,
  targetPxPerYear: null,

  /** Zoom to a new pxPerYear, keeping the current centerYear pinned. */
  setPxPerYear: (newPx: number) => {
    const { centerYear, viewportWidth } = get();
    const newScrollLeft = Math.max(0, (centerYear - YEAR_START) * newPx - viewportWidth / 2);
    const newCenterYear = Math.floor((newScrollLeft + viewportWidth / 2) / newPx) + YEAR_START;
    set({ pxPerYear: newPx, scrollLeft: newScrollLeft, centerYear: newCenterYear });
  },

  /** Update scroll position (from native pan), recomputing centerYear. */
  setScrollLeft: (scrollLeft: number) => {
    const { viewportWidth, pxPerYear } = get();
    const center = Math.floor((scrollLeft + viewportWidth / 2) / pxPerYear) + YEAR_START;
    set({ scrollLeft, centerYear: center });
  },

  setViewportWidth: (width: number) => {
    set({ viewportWidth: width });
  },

  setTargetPxPerYear: (px: number | null) => {
    const clamped = px === null ? null : Math.max(MIN_PX_PER_YEAR, Math.min(MAX_PX_PER_YEAR, px));
    set({ targetPxPerYear: clamped });
  },
}));
