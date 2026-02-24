import { create } from "zustand";

export const TOUR_DONE_KEY     = "mizan_tour_done";
export const MAP_TOUR_DONE_KEY = "mizan_map_tour_done";
export const TOUR_STEPS        = 3;
export const MAP_TOUR_STEPS    = 2;

interface TourState {
  active:       boolean;
  step:         number;
  start:        () => void;
  next:         () => void;
  skip:         () => void;

  mapTourActive: boolean;
  mapTourStep:   number;
  startMapTour:  () => void;
  nextMapTour:   () => void;
  skipMapTour:   () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  step:   0,

  start: () => set({ active: true, step: 0 }),

  next: () => {
    const next = get().step + 1;
    if (next >= TOUR_STEPS) {
      if (typeof window !== "undefined") localStorage.setItem(TOUR_DONE_KEY, "1");
      set({ active: false, step: 0 });
    } else {
      set({ step: next });
    }
  },

  skip: () => {
    if (typeof window !== "undefined") localStorage.setItem(TOUR_DONE_KEY, "1");
    set({ active: false, step: 0 });
  },

  mapTourActive: false,
  mapTourStep:   0,

  startMapTour: () => set({ mapTourActive: true, mapTourStep: 0 }),

  nextMapTour: () => {
    const next = get().mapTourStep + 1;
    if (next >= MAP_TOUR_STEPS) {
      if (typeof window !== "undefined") localStorage.setItem(MAP_TOUR_DONE_KEY, "1");
      set({ mapTourActive: false, mapTourStep: 0 });
    } else {
      set({ mapTourStep: next });
    }
  },

  skipMapTour: () => {
    if (typeof window !== "undefined") localStorage.setItem(MAP_TOUR_DONE_KEY, "1");
    set({ mapTourActive: false, mapTourStep: 0 });
  },
}));
