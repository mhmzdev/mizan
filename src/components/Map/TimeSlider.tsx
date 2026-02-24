"use client";

import React, { useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useFormatYear } from "@/hooks/useFormatYear";
import { YEAR_START, YEAR_END } from "@/utils/constants";

/** Default 200-year window centred on 1 BC/AD */
const DEFAULT_START = -100;
const DEFAULT_END   = 99;
const TOTAL_YEARS   = YEAR_END - YEAR_START;

export function TimeSlider() {
  const rangeStart = useTimelineStore((s) => s.rangeStart);
  const rangeEnd   = useTimelineStore((s) => s.rangeEnd);
  const setRange   = useTimelineStore((s) => s.setRange);
  const fmt        = useFormatYear();

  const trackRef    = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"left" | "right" | null>(null);

  // Keep refs up-to-date so pointer handlers don't close over stale values
  const startRef = useRef(rangeStart ?? DEFAULT_START);
  const endRef   = useRef(rangeEnd   ?? DEFAULT_END);
  startRef.current = rangeStart ?? DEFAULT_START;
  endRef.current   = rangeEnd   ?? DEFAULT_END;

  // Initialise default range on first mount if none is active
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (rangeStart === null || rangeEnd === null) {
      setRange(DEFAULT_START, DEFAULT_END);
    }
  }, []);

  const start = rangeStart ?? DEFAULT_START;
  const end   = rangeEnd   ?? DEFAULT_END;

  const yearToPercent = (year: number) =>
    ((year - YEAR_START) / TOTAL_YEARS) * 100;

  const startPct = yearToPercent(start);
  const endPct   = yearToPercent(end);

  function pixelToYear(clientX: number): number {
    if (!trackRef.current) return YEAR_START;
    const rect = trackRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(YEAR_START + pct * TOTAL_YEARS);
  }

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

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const year = pixelToYear(e.clientX);
    if (draggingRef.current === "left") {
      setRange(Math.max(YEAR_START, Math.min(year, endRef.current - 1)), endRef.current);
    } else {
      setRange(startRef.current, Math.min(YEAR_END, Math.max(year, startRef.current + 1)));
    }
  }

  function handlePointerUp() {
    draggingRef.current = null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
      {/* Year labels — float above the bar */}
      <div className="relative h-6 mb-1 pointer-events-none select-none">
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
      </div>

      {/* Glassmorphism track bar */}
      <div
        ref={trackRef}
        className="relative h-10 rounded-xl overflow-hidden
                   bg-no-panel/75 backdrop-blur-md
                   border border-white/10
                   shadow-[0_4px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        {/* Subtle center line */}
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-px bg-no-border/40 rounded-full pointer-events-none" />

        {/* Hatched fill between handles */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left:  `${startPct}%`,
            width: `${endPct - startPct}%`,
          }}
        >
          {/* Tint */}
          <div className="absolute inset-0 bg-no-blue/10" />
          {/* Hatch */}
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="ts-hatch"
                width="10"
                height="10"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(116,160,255,0.2)" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ts-hatch)" />
          </svg>
        </div>

        {/* Left thumb */}
        <div
          className="absolute top-0 bottom-0 z-10 flex items-center justify-center
                     cursor-ew-resize touch-none"
          style={{ left: `${startPct}%`, transform: "translateX(-50%)", width: "28px" }}
          onPointerDown={handleLeftDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          aria-label="Range start"
          role="slider"
          aria-valuenow={start}
          aria-valuemin={YEAR_START}
          aria-valuemax={end - 1}
        >
          <div className="w-[3px] h-6 rounded-full bg-no-blue/70 hover:bg-no-blue transition-colors shadow-sm" />
        </div>

        {/* Right thumb */}
        <div
          className="absolute top-0 bottom-0 z-10 flex items-center justify-center
                     cursor-ew-resize touch-none"
          style={{ left: `${endPct}%`, transform: "translateX(-50%)", width: "28px" }}
          onPointerDown={handleRightDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          aria-label="Range end"
          role="slider"
          aria-valuenow={end}
          aria-valuemin={start + 1}
          aria-valuemax={YEAR_END}
        >
          <div className="w-[3px] h-6 rounded-full bg-no-blue/70 hover:bg-no-blue transition-colors shadow-sm" />
        </div>
      </div>
    </div>
  );
}
