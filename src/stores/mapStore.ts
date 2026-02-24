import { create } from "zustand";

export type ViewMode = "timeline" | "map";

export const VIEW_MODE_KEY = "mizan_view_mode";
const MAP_CENTER_KEY = "mizan_map_center";
const MAP_ZOOM_KEY   = "mizan_map_zoom";
const MAP_RANGE_KEY  = "mizan_map_range";

const DEFAULT_MAP_RANGE = { start: -100, end: 99 };

function readMapRange(): { start: number; end: number } {
  if (typeof window === "undefined") return DEFAULT_MAP_RANGE;
  try {
    const stored = localStorage.getItem(MAP_RANGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { start: unknown; end: unknown };
      if (typeof parsed.start === "number" && typeof parsed.end === "number") return parsed as { start: number; end: number };
    }
  } catch { /* ignore */ }
  return DEFAULT_MAP_RANGE;
}

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "timeline";
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  if (stored === "timeline" || stored === "map") return stored;
  return "timeline";
}

function readMapCenter(): { lat: number; lng: number } {
  if (typeof window === "undefined") return { lat: 32, lng: 35 };
  try {
    const stored = localStorage.getItem(MAP_CENTER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed;
    }
  } catch { /* ignore */ }
  return { lat: 32, lng: 35 };
}

function readMapZoom(): number {
  if (typeof window === "undefined") return 4;
  const stored = localStorage.getItem(MAP_ZOOM_KEY);
  if (stored !== null) {
    const z = parseFloat(stored);
    if (!isNaN(z)) return z;
  }
  return 4;
}

interface MapState {
  viewMode: ViewMode;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  /** Map-only year range driven by the TimeSlider — independent of the timeline sidebar range. */
  mapRangeStart: number;
  mapRangeEnd:   number;
  drawerPreviewPin: { lat: number; lng: number; noteId: number | null } | null;
  /** true = next map tap assigns location to the currently open note */
  locationPickMode: boolean;
  /** written by MapView on tap in pick mode; consumed + cleared by NoteDrawer */
  pendingLocationPick: { lat: number; lng: number } | null;

  setViewMode: (mode: ViewMode) => void;
  setMapCenter: (c: { lat: number; lng: number }) => void;
  setMapZoom: (z: number) => void;
  setMapRange: (start: number, end: number) => void;
  setDrawerPreviewPin: (pin: { lat: number; lng: number; noteId: number | null } | null) => void;
  setLocationPickMode: (active: boolean) => void;
  setPendingLocationPick: (loc: { lat: number; lng: number } | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  // Always start with "timeline" — SSR and first client render must agree.
  // The real saved value is restored in useUrlSync's init useEffect (client-only).
  viewMode:            "timeline",
  mapCenter:           readMapCenter(),
  mapZoom:             readMapZoom(),
  mapRangeStart:       readMapRange().start,
  mapRangeEnd:         readMapRange().end,
  drawerPreviewPin:    null,
  locationPickMode:    false,
  pendingLocationPick: null,

  setViewMode: (mode) => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_MODE_KEY, mode);
    set({ viewMode: mode });
  },

  setMapRange: (start, end) => {
    if (typeof window !== "undefined")
      localStorage.setItem(MAP_RANGE_KEY, JSON.stringify({ start, end }));
    set({ mapRangeStart: start, mapRangeEnd: end });
  },

  setMapCenter: (c) => {
    if (typeof window !== "undefined") localStorage.setItem(MAP_CENTER_KEY, JSON.stringify(c));
    set({ mapCenter: c });
  },

  setMapZoom: (z) => {
    if (typeof window !== "undefined") localStorage.setItem(MAP_ZOOM_KEY, String(z));
    set({ mapZoom: z });
  },

  setDrawerPreviewPin: (pin) => {
    set({ drawerPreviewPin: pin });
  },

  setLocationPickMode: (active) => {
    set({ locationPickMode: active });
  },

  setPendingLocationPick: (loc) => {
    set({ pendingLocationPick: loc });
  },
}));
