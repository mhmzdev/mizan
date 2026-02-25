"use client";

import React, { useRef } from "react";
import { useMapStore } from "@/stores/mapStore";
import { useFormatYear } from "@/hooks/useFormatYear";
import { YEAR_START, YEAR_END } from "@/utils/constants";

const TOTAL_YEARS = YEAR_END - YEAR_START;

type DragMode = "left" | "right" | "center" | "history" | null;

export function TimeSlider() {
  const start        = useMapStore((s) => s.mapRangeStart);
  const end          = useMapStore((s) => s.mapRangeEnd);
  const setRange     = useMapStore((s) => s.setMapRange);
  const historyMode  = useMapStore((s) => s.historyMode);
  const historyYear  = useMapStore((s) => s.historyYear);
  const setHistoryYear = useMapStore((s) => s.setHistoryYear);
  const fmt          = useFormatYear();

  const trackRef    = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<DragMode>(null);

  // Anchor snapshot for center-drag pan
  const centerAnchorRef = useRef<{
    anchorYear: number;
    initStart:  number;
    initEnd:    number;
  } | null>(null);

  // Always-current refs so pointer handlers never close over stale values
  const startRef       = useRef(start);
  const endRef         = useRef(end);
  const historyYearRef = useRef(historyYear);
  startRef.current       = start;
  endRef.current         = end;
  historyYearRef.current = historyYear;

  const yearToPercent = (year: number) =>
    ((year - YEAR_START) / TOTAL_YEARS) * 100;

  const startPct   = yearToPercent(start);
  const endPct     = yearToPercent(end);
  const historyPct = yearToPercent(historyYear);

  // Hide history label if it's too close (< 5 percentage points) to either range label
  const historyLabelVisible =
    historyMode &&
    Math.abs(historyPct - startPct) > 5 &&
    Math.abs(historyPct - endPct)   > 5;

  function pixelToYear(clientX: number): number {
    if (!trackRef.current) return YEAR_START;
    const rect = trackRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(YEAR_START + pct * TOTAL_YEARS);
  }

  // ── Thumb handlers ────────────────────────────────────────────────────────

  function handleLeftDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    draggingRef.current = "left";
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleRightDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    draggingRef.current = "right";
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // ── Center (pan) handler ──────────────────────────────────────────────────

  function handleCenterDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    draggingRef.current = "center";
    centerAnchorRef.current = {
      anchorYear: pixelToYear(e.clientX),
      initStart:  startRef.current,
      initEnd:    endRef.current,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // ── History handle handler ────────────────────────────────────────────────

  function handleHistoryDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation(); // prevent center region from capturing first
    draggingRef.current = "history";
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // ── Shared move / up ─────────────────────────────────────────────────────

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const mode = draggingRef.current;
    if (!mode) return;

    const year = pixelToYear(e.clientX);

    if (mode === "left") {
      setRange(
        Math.max(YEAR_START, Math.min(year, endRef.current - 1)),
        endRef.current,
      );
    } else if (mode === "right") {
      setRange(
        startRef.current,
        Math.min(YEAR_END, Math.max(year, startRef.current + 1)),
      );
    } else if (mode === "center" && centerAnchorRef.current) {
      const { anchorYear, initStart, initEnd } = centerAnchorRef.current;
      const windowSize = initEnd - initStart;
      const delta      = year - anchorYear;
      const newStart   = Math.max(YEAR_START, Math.min(initStart + delta, YEAR_END - windowSize));
      setRange(newStart, newStart + windowSize);
    } else if (mode === "history") {
      setHistoryYear(Math.max(YEAR_START, Math.min(YEAR_END, year)));
    }
  }

  function handlePointerUp() {
    draggingRef.current     = null;
    centerAnchorRef.current = null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
      {/* Year labels — float above the bar */}
      <div className="relative h-6 mb-1 pointer-events-none select-none">
        {/* Range start label */}
        <span
          className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap
                     px-1.5 py-0.5 rounded
                     bg-no-panel/90 border border-no-border/60
                     backdrop-blur-sm shadow-sm
                     text-no-blue/90 text-[10px] font-mono"
          style={{ left: `${startPct}%` }}
        >
          {fmt(start)}
        </span>

        {/* Range end label */}
        <span
          className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap
                     px-1.5 py-0.5 rounded
                     bg-no-panel/90 border border-no-border/60
                     backdrop-blur-sm shadow-sm
                     text-no-blue/90 text-[10px] font-mono"
          style={{ left: `${endPct}%` }}
        >
          {fmt(end)}
        </span>

        {/* History year label — amber, shown only when not colliding with range labels */}
        {historyLabelVisible && (
          <span
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap
                       px-1.5 py-0.5 rounded
                       bg-amber-950/90 border border-amber-400/50
                       backdrop-blur-sm shadow-sm
                       text-amber-300 text-[10px] font-mono"
            style={{ left: `${historyPct}%` }}
          >
            {fmt(historyYear)}
          </span>
        )}
      </div>

      {/* Glassmorphism track bar */}
      <div
        ref={trackRef}
        data-tour="tour-time-slider"
        className="relative h-10 rounded-xl overflow-hidden
                   bg-no-panel/75 backdrop-blur-md
                   border border-white/10
                   shadow-[0_4px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        {/* Subtle center line */}
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-px bg-no-border/40 rounded-full pointer-events-none" />

        {/* ── Draggable center region — pans the whole window ── */}
        <div
          className="absolute top-0 bottom-0 z-[5] cursor-grab active:cursor-grabbing touch-none"
          style={{
            left:  `${startPct}%`,
            width: `${endPct - startPct}%`,
          }}
          onPointerDown={handleCenterDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          aria-label="Drag to pan the time window"
        >
          {/* Tint */}
          <div className="absolute inset-0 bg-no-blue/10 pointer-events-none" />
          {/* Hatch */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="ts-hatch"
                width="10" height="10"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(116,160,255,0.2)" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ts-hatch)" />
          </svg>
        </div>

        {/* ── Left thumb ── */}
        <div
          className="absolute top-0 bottom-0 z-10 flex items-center justify-center
                     cursor-ew-resize touch-none"
          style={{ left: `${startPct}%`, transform: "translateX(-50%)", width: "28px" }}
          onPointerDown={handleLeftDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider"
          aria-label="Range start"
          aria-valuenow={start}
          aria-valuemin={YEAR_START}
          aria-valuemax={end - 1}
        >
          <div className="w-[3px] h-6 rounded-full bg-no-blue/70 hover:bg-no-blue transition-colors shadow-sm" />
        </div>

        {/* ── Right thumb ── */}
        <div
          className="absolute top-0 bottom-0 z-10 flex items-center justify-center
                     cursor-ew-resize touch-none"
          style={{ left: `${endPct}%`, transform: "translateX(-50%)", width: "28px" }}
          onPointerDown={handleRightDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider"
          aria-label="Range end"
          aria-valuenow={end}
          aria-valuemin={start + 1}
          aria-valuemax={YEAR_END}
        >
          <div className="w-[3px] h-6 rounded-full bg-no-blue/70 hover:bg-no-blue transition-colors shadow-sm" />
        </div>

        {/* ── History year handle — only when history mode is active ── */}
        {historyMode && (
          <div
            className="absolute top-0 bottom-0 z-20 flex flex-col items-center justify-center
                       cursor-ew-resize touch-none"
            style={{ left: `${historyPct}%`, transform: "translateX(-50%)", width: "28px" }}
            onPointerDown={handleHistoryDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            role="slider"
            aria-label="Historical map year"
            aria-valuenow={historyYear}
            aria-valuemin={YEAR_START}
            aria-valuemax={YEAR_END}
          >
            {/* Diamond head */}
            <div
              className="absolute w-2.5 h-2.5 rotate-45 bg-amber-400
                         shadow-[0_0_8px_rgba(251,191,36,0.8)]"
              style={{ top: "6px" }}
            />
            {/* Amber glow line */}
            <div className="w-[2px] h-7 rounded-full bg-amber-400
                            shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
          </div>
        )}
      </div>
    </div>
  );
}
