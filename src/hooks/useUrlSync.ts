"use client";

import { useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
import { useMapStore, VIEW_MODE_KEY } from "@/stores/mapStore";
import {
  MIN_PX_PER_YEAR,
  MAX_PX_PER_YEAR,
  YEAR_START,
  YEAR_END,
  PX_PER_YEAR,
} from "@/utils/constants";

/** Debounce window for URL writes — long enough to avoid thrashing during scroll. */
const DEBOUNCE_MS = 350;

const STORAGE_KEY = "mizan_last_view";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Parse deep-link params from the current URL. */
function parseUrlParams(): {
  year: number | null;
  zoom: number | null;
  noteId: number | null;
  rangeFrom: number | null;
  rangeTo:   number | null;
  mapRangeFrom: number | null;
  mapRangeTo:   number | null;
  view: "map" | "timeline" | null;
  historyMode: boolean | null;
  historyYear: number | null;
} {
  if (typeof window === "undefined")
    return { year: null, zoom: null, noteId: null, rangeFrom: null, rangeTo: null, mapRangeFrom: null, mapRangeTo: null, view: null, historyMode: null, historyYear: null };
  const p = new URLSearchParams(window.location.search);
  const y   = p.get("year");
  const z   = p.get("zoom");
  const n   = p.get("note");
  const rf  = p.get("range_from");
  const rt  = p.get("range_to");
  const mrf = p.get("map_range_from");
  const mrt = p.get("map_range_to");
  const v   = p.get("view");
  const hm  = p.get("history");
  const hy  = p.get("history_year");
  return {
    year:         y   !== null ? parseInt(y,   10) : null,
    zoom:         z   !== null ? parseFloat(z)     : null,
    noteId:       n   !== null ? parseInt(n,   10) : null,
    rangeFrom:    rf  !== null ? parseInt(rf,  10) : null,
    rangeTo:      rt  !== null ? parseInt(rt,  10) : null,
    mapRangeFrom: mrf !== null ? parseInt(mrf, 10) : null,
    mapRangeTo:   mrt !== null ? parseInt(mrt, 10) : null,
    view:         (v === "map" || v === "timeline") ? v : null,
    historyMode:  hm  !== null ? hm === "1" : null,
    historyYear:  hy  !== null ? parseInt(hy, 10) : null,
  };
}

/**
 * Returns a shareable URL for a specific note, including its year and current view mode.
 * e.g. https://your-domain.com/?year=-44&note=7&view=map
 */
export function buildNoteUrl(noteId: number, year: number): string {
  if (typeof window === "undefined") return "";
  const view = useMapStore.getState().viewMode;
  return `${window.location.origin}${window.location.pathname}?year=${year}&note=${noteId}&view=${view}`;
}

/**
 * Syncs the timeline view ↔ URL.
 *
 * Initialisation  — reads ?year=, ?zoom= (or ?note=, handled in page.tsx) and
 *                   fires a pendingNav to jump the timeline there instantly.
 * Continuous sync — debounces URL writes whenever the store changes:
 *   • drawer open  with a saved note  →  ?note={id}
 *   • everything else                 →  ?year={n}&zoom={n}
 */
export function useUrlSync() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. One-time initialisation ─────────────────────────────────────────────
  useEffect(() => {
    const { year, zoom, noteId, rangeFrom, rangeTo, mapRangeFrom, mapRangeTo, view, historyMode, historyYear } = parseUrlParams();

    // Restore view mode — URL param takes priority, then localStorage
    if (view !== null) {
      useMapStore.getState().setViewMode(view);
    } else {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "map" || saved === "timeline") {
        useMapStore.getState().setViewMode(saved);
      }
    }

    // Restore map slider range from URL (overrides localStorage default)
    if (mapRangeFrom !== null && mapRangeTo !== null) {
      useMapStore.getState().setMapRange(mapRangeFrom, mapRangeTo);
    }

    // Restore history mode + year from URL (overrides localStorage)
    if (historyMode !== null) {
      useMapStore.getState().setHistoryMode(historyMode);
    }
    if (historyYear !== null && !isNaN(historyYear)) {
      useMapStore.getState().setHistoryYear(historyYear);
    }

    // ?note= deep links are handled separately in page.tsx after notes load.
    if (noteId !== null) return;

    if (year !== null || zoom !== null) {
      // Explicit URL params take priority over saved state.
      const safeZoom = clamp(zoom ?? PX_PER_YEAR.centuries, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
      const safeYear = clamp(year ?? useTimelineStore.getState().centerYear, YEAR_START, YEAR_END);
      useTimelineStore.getState().setPendingNav({ year: safeYear, zoom: safeZoom });
      // Also restore range if encoded in the URL.
      if (rangeFrom !== null && rangeTo !== null) {
        useTimelineStore.getState().setRange(rangeFrom, rangeTo);
      }
      return;
    }

    // No URL params — restore the last saved position from localStorage.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          year: number; zoom: number;
          rangeFrom?: number; rangeTo?: number;
        };
        if (Number.isFinite(saved.year) && Number.isFinite(saved.zoom)) {
          useTimelineStore.getState().setPendingNav({
            year: clamp(saved.year, YEAR_START, YEAR_END),
            zoom: clamp(saved.zoom, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR),
          });
        }
        if (Number.isFinite(saved.rangeFrom) && Number.isFinite(saved.rangeTo)) {
          useTimelineStore.getState().setRange(saved.rangeFrom!, saved.rangeTo!);
        }
      }
    } catch {
      // Ignore malformed storage values.
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Continuous store → URL sync ────────────────────────────────────────
  useEffect(() => {
    function writeUrl() {
      const notes    = useNotesStore.getState();
      const timeline = useTimelineStore.getState();

      const { viewMode } = useMapStore.getState();

      if (notes.drawerOpen && notes.editingNoteId !== null) {
        // A saved note is open — include its year so the URL is human-readable.
        const note = notes.notes.find((n) => n.id === notes.editingNoteId);
        const yearPart = note ? `year=${note.year}&` : "";
        window.history.replaceState(
          null, "",
          `${window.location.pathname}?${yearPart}note=${notes.editingNoteId}&view=${viewMode}`,
        );
      } else {
        // No note open — reflect the current viewport position.
        const year = Math.round(timeline.centerYear);
        const zoom = Math.round(timeline.pxPerYear * 100) / 100;
        const params = new URLSearchParams();
        params.set("year", String(year));
        params.set("zoom", String(zoom));
        params.set("view", viewMode);
        if (timeline.rangeStart !== null && timeline.rangeEnd !== null) {
          params.set("range_from", String(timeline.rangeStart));
          params.set("range_to",   String(timeline.rangeEnd));
        }
        // Map slider range — always present, stored separately from timeline range
        const { mapRangeStart, mapRangeEnd, historyMode: hm, historyYear: hy } = useMapStore.getState();
        params.set("map_range_from", String(mapRangeStart));
        params.set("map_range_to",   String(mapRangeEnd));
        // History mode — only include in URL when active to keep links clean
        if (hm) {
          params.set("history",      "1");
          params.set("history_year", String(hy));
        }
        window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
        // Persist timeline position + explicit timeline range to localStorage.
        // (Map range persists itself via mapStore.setMapRange → localStorage.)
        try {
          const data: Record<string, number> = { year, zoom };
          if (timeline.rangeStart !== null && timeline.rangeEnd !== null) {
            data.rangeFrom = timeline.rangeStart;
            data.rangeTo   = timeline.rangeEnd;
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch { /* quota */ }
      }
    }

    function schedule() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(writeUrl, DEBOUNCE_MS);
    }

    // timelineStore: fire on every change (scroll / zoom)
    const unsubTimeline = useTimelineStore.subscribe(schedule);

    // notesStore: only fire when drawer state changes — avoid reacting to every note save
    let prevDrawerOpen = useNotesStore.getState().drawerOpen;
    let prevEditingId  = useNotesStore.getState().editingNoteId;
    const unsubNotes = useNotesStore.subscribe((state) => {
      if (
        state.drawerOpen    !== prevDrawerOpen ||
        state.editingNoteId !== prevEditingId
      ) {
        prevDrawerOpen = state.drawerOpen;
        prevEditingId  = state.editingNoteId;
        schedule();
      }
    });

    // mapStore: fire when view mode, map slider range, or history state changes
    const unsubMap = useMapStore.subscribe((state, prev) => {
      if (
        state.viewMode      !== prev.viewMode      ||
        state.mapRangeStart !== prev.mapRangeStart ||
        state.mapRangeEnd   !== prev.mapRangeEnd   ||
        state.historyMode   !== prev.historyMode   ||
        state.historyYear   !== prev.historyYear
      ) schedule();
    });

    return () => {
      unsubTimeline();
      unsubNotes();
      unsubMap();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // store refs are stable — no reactive deps needed
}
