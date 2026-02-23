"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { TimelineEvent } from "@/types";
import { YEAR_START } from "@/utils/constants";
import { useFormatYear } from "@/hooks/useFormatYear";
import { useNotesStore } from "@/stores/notesStore";

/* ── Layout constants ─────────────────────────────────────────────────────── */
/**
 * The global track is given min-h-[120px] in TimelineTrack.
 * Center sits at y=60, leaving 30px clear at the top for YearBlock tick+label
 * (tick ≤14px + label ≤14px ≈ 28px) and 10px margin at the bottom.
 */
const TRACK_CENTER_Y  = 60;
const LABEL_CLEARANCE = 32; // px from track top that must stay free

/**
 * Dot radius keyed by zoom band.
 *   centuries (< 15 px/yr)  → r=2  (dense, data-density read)
 *   decades   (15–99 px/yr) → r=3  (medium, comfortable clicking)
 *   years     (≥ 100 px/yr) → r=5  (matches NoteDot DOT_SIZE/2)
 */
function getDotRadius(pxPerYear: number): number {
  if (pxPerYear >= 100) return 5;
  if (pxPerYear >= 15)  return 3;
  return 2;
}

interface HoveredDot {
  event: TimelineEvent;
  cx: number;
  cy: number;
}

interface HistographyLayerProps {
  events: TimelineEvent[];
  pxPerYear: number;
}

/**
 * Renders global-track events as stacked dot columns, histography-style.
 * Dots grow symmetrically above and below the timeline centerline.
 */
export function HistographyLayer({ events, pxPerYear }: HistographyLayerProps) {
  const [hovered,   setHovered]   = useState<HoveredDot | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fmt = useFormatYear();

  /* ── Active event (drawer open for this event) ───────────────────────── */
  const drawerOpen        = useNotesStore((s) => s.drawerOpen);
  const pendingSourceEvent = useNotesStore((s) => s.pendingSourceEvent);
  const activeEventId = drawerOpen && pendingSourceEvent ? pendingSourceEvent.id : null;

  /* ── Filter out events that have a linked user note ──────────────────── */
  const allNotes = useNotesStore((s) => s.notes);
  const linkedEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of allNotes) {
      if (n.sourceEventId) ids.add(n.sourceEventId);
    }
    return ids;
  }, [allNotes]);

  const filteredEvents = useMemo(
    () => events.filter((ev) => !linkedEventIds.has(ev.id)),
    [events, linkedEventIds]
  );

  /* ── Derived sizing (all zoom-adaptive) ──────────────────────────────── */
  const dotR       = getDotRadius(pxPerYear);
  const spacing    = dotR * 2 + 1;                                    // tight 1px gap
  const maxPerSide = Math.floor((TRACK_CENTER_Y - LABEL_CLEARANCE) / spacing);

  // Bucket width — ensures each column is at least one dot-diameter wide
  const bucketYears = Math.max(1, Math.ceil((dotR * 2) / pxPerYear));

  /* ── Group events into columns ───────────────────────────────────────── */
  const columns = useMemo(() => {
    const map = new Map<number, TimelineEvent[]>();
    for (const ev of filteredEvents) {
      const bucket = Math.floor(ev.year / bucketYears) * bucketYears;
      const arr = map.get(bucket);
      if (arr) arr.push(ev);
      else map.set(bucket, [ev]);
    }
    return Array.from(map.entries()).map(([year, evs]) => ({
      year,
      events: evs,
      cx: (year - YEAR_START) * pxPerYear + (bucketYears * pxPerYear) / 2,
    }));
  }, [filteredEvents, pxPerYear, bucketYears]);

  /* ── Hover handlers with leave-delay to prevent flicker ─────────────── */
  const handleEnter = useCallback((ev: TimelineEvent, cx: number, cy: number) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered({ event: ev, cx, cy });
    setHoveredId(ev.id);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setHovered(null);
      setHoveredId(null);
    }, 80);
  }, []);

  const handleClick = useCallback((ev: TimelineEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    useNotesStore.getState().openDrawer(ev.year, undefined, ev.title, ev);
  }, []);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="absolute inset-0" style={{ pointerEvents: "none" }}>

      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: "visible", pointerEvents: "none" }}
      >
        {columns.map(({ year, events: colEvents, cx }) => {
          const aboveCount = Math.min(Math.ceil(colEvents.length / 2), maxPerSide);
          const belowCount = Math.min(Math.floor(colEvents.length / 2), maxPerSide);

          return (
            <g key={year}>
              {/* Dots above centerline */}
              {Array.from({ length: aboveCount }, (_, i) => {
                const ev  = colEvents[i * 2];
                const cy  = TRACK_CENTER_Y - (i + 1) * spacing;
                const isH = hoveredId === ev.id;
                const isA = activeEventId === ev.id;
                return (
                  <g key={ev.id}>
                    {isA && <circle cx={cx} cy={cy} r={dotR + 1} fill="rgba(116,160,255,0.6)" className="histo-ring" />}
                    <circle
                      cx={cx} cy={cy}
                      r={isA ? dotR + 2 : (isH ? dotR + 1.5 : dotR)}
                      fill="rgba(116,160,255,1)"
                      fillOpacity={isA ? 1 : (isH ? 1 : 0.55)}
                      className={isA ? "histo-glow" : undefined}
                      style={{ pointerEvents: "auto", cursor: "pointer", transition: isA ? undefined : "r 0.1s, fill-opacity 0.1s" }}
                      onMouseEnter={() => { if (!isA) handleEnter(ev, cx, cy); }}
                      onMouseLeave={handleLeave}
                      onClick={(e) => handleClick(ev, e)}
                    />
                  </g>
                );
              })}

              {/* Dots below centerline */}
              {Array.from({ length: belowCount }, (_, i) => {
                const ev  = colEvents[i * 2 + 1];
                const cy  = TRACK_CENTER_Y + (i + 1) * spacing;
                const isH = hoveredId === ev.id;
                const isA = activeEventId === ev.id;
                return (
                  <g key={ev.id}>
                    {isA && <circle cx={cx} cy={cy} r={dotR + 1} fill="rgba(116,160,255,0.6)" className="histo-ring" />}
                    <circle
                      cx={cx} cy={cy}
                      r={isA ? dotR + 2 : (isH ? dotR + 1.5 : dotR)}
                      fill="rgba(116,160,255,1)"
                      fillOpacity={isA ? 1 : (isH ? 1 : 0.55)}
                      className={isA ? "histo-glow" : undefined}
                      style={{ pointerEvents: "auto", cursor: "pointer", transition: isA ? undefined : "r 0.1s, fill-opacity 0.1s" }}
                      onMouseEnter={() => { if (!isA) handleEnter(ev, cx, cy); }}
                      onMouseLeave={handleLeave}
                      onClick={(e) => handleClick(ev, e)}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* ── Hover tooltip — hidden when that dot is the active one ─────── */}
      {hovered && hovered.event.id !== activeEventId && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: hovered.cx,
            top: hovered.cy + dotR + 8,
            transform: "translate(-50%, 0)",
          }}
        >
          <div className="bg-no-panel border border-no-border/80 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
            <p className="text-no-text text-[12px] font-medium leading-snug">{hovered.event.title}</p>
            <p className="text-no-muted text-[10px] font-mono mt-0.5">{fmt(hovered.event.year)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
