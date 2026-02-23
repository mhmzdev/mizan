import { create } from "zustand";
import { YearNotation } from "@/types";

const NOTATION_KEY = "mizan_notation";

function readNotation(): YearNotation {
  if (typeof window === "undefined") return "BC/AD";
  const stored = localStorage.getItem(NOTATION_KEY);
  if (stored === "BC/AD" || stored === "BCE/CE" || stored === "BH/AH") return stored;
  return "BC/AD";
}

interface SettingsState {
  notation: YearNotation;
  setNotation: (notation: YearNotation) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  notation: readNotation(),
  setNotation: (notation) => {
    if (typeof window !== "undefined") localStorage.setItem(NOTATION_KEY, notation);
    set({ notation });
  },
}));
