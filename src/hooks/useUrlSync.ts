"use client";

import { useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
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

/** Parse the three deep-link params from the current URL. */
function parseUrlParams(): {
  year: number | null;
  zoom: number | null;
  noteId: number | null;
} {
  if (typeof window === "undefined") return { year: null, zoom: null, noteId: null };
  const p = new URLSearchParams(window.location.search);
  const y = p.get("year");
  const z = p.get("zoom");
  const n = p.get("note");
  return {
    year:   y !== null ? parseInt(y,   10) : null,
    zoom:   z !== null ? parseFloat(z)     : null,
    noteId: n !== null ? parseInt(n,   10) : null,
  };
}

/**
 * Returns a shareable URL for a specific note.
 * e.g. https://your-domain.com/?note=7
 */
export function buildNoteUrl(noteId: number): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}?note=${noteId}`;
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
    const { year, zoom, noteId } = parseUrlParams();

    // ?note= deep links are handled separately in page.tsx after notes load.
    if (noteId !== null) return;

    if (year !== null || zoom !== null) {
      // Explicit URL params take priority over saved state.
      const safeZoom = clamp(zoom ?? PX_PER_YEAR.centuries, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
      const safeYear = clamp(year ?? useTimelineStore.getState().centerYear, YEAR_START, YEAR_END);
      useTimelineStore.getState().setPendingNav({ year: safeYear, zoom: safeZoom });
      return;
    }

    // No URL params — restore the last saved position from localStorage.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { year: sy, zoom: sz } = JSON.parse(raw) as { year: number; zoom: number };
        if (Number.isFinite(sy) && Number.isFinite(sz)) {
          useTimelineStore.getState().setPendingNav({
            year: clamp(sy, YEAR_START, YEAR_END),
            zoom: clamp(sz, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR),
          });
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

      if (notes.drawerOpen && notes.editingNoteId !== null) {
        // A saved note is open — expose its id so the URL is shareable.
        window.history.replaceState(
          null, "",
          `${window.location.pathname}?note=${notes.editingNoteId}`,
        );
      } else {
        // No note open — reflect the current viewport position.
        const year = Math.round(timeline.centerYear);
        const zoom = Math.round(timeline.pxPerYear * 100) / 100;
        const params = new URLSearchParams();
        params.set("year", String(year));
        params.set("zoom", String(zoom));
        window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
        // Persist so the next page load restores this position.
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ year, zoom })); } catch { /* quota */ }
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

    return () => {
      unsubTimeline();
      unsubNotes();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // store refs are stable — no reactive deps needed
}
