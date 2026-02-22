import { create } from "zustand";

export const TOUR_DONE_KEY = "mizan_tour_done";
export const TOUR_STEPS    = 3;

interface TourState {
  active: boolean;
  step:   number;
  start:  () => void;
  next:   () => void;
  skip:   () => void;
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
}));
