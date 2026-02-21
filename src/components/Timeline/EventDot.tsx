"use client";

import React, { useState } from "react";
import { TimelineEvent, ZoomMode } from "@/types";
import { PX_PER_YEAR, YEAR_START } from "@/utils/constants";
import { formatYear } from "@/utils/yearUtils";

interface EventDotProps {
  event: TimelineEvent;
  mode: ZoomMode;
}

function EventDotInner({ event, mode }: EventDotProps) {
  const [hovered, setHovered] = useState(false);

  if (mode !== "years") return null;

  const pxPerYear = PX_PER_YEAR[mode];
  const leftPx    = (event.year - YEAR_START) * pxPerYear + pxPerYear / 2;

  return (
    <div
      className="absolute -translate-x-1/2"
      style={{ left: leftPx, top: 40, zIndex: hovered ? 50 : 10 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Expanding circle */}
      <div
        className="rounded-full transition-all duration-300 ease-out flex items-center justify-center cursor-pointer"
        style={{
          width:           hovered ? 52 : 8,
          height:          hovered ? 52 : 8,
          background:      hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.75)",
          border:          hovered ? "1.5px solid rgba(255,255,255,0.55)" : "1.5px solid transparent",
          boxShadow:       hovered ? "0 0 0 4px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {/* Inner centre dot — always present, just shrinks away when collapsed */}
        <div
          className="rounded-full bg-white transition-all duration-300"
          style={{
            width:   hovered ? 5 : 0,
            height:  hovered ? 5 : 0,
            opacity: hovered ? 0.7 : 0,
          }}
        />
      </div>

      {/* Title + year — fades + slides in below */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-300"
        style={{
          top:     hovered ? 60 : 48,
          opacity: hovered ? 1 : 0,
          width:   160,
        }}
      >
        <p className="text-white text-[11px] uppercase tracking-widest font-semibold text-center leading-snug">
          {event.title}
        </p>
        <p className="text-white/45 text-[10px] font-mono mt-1">
          {formatYear(event.year)}
        </p>
      </div>
    </div>
  );
}

export const EventDot = React.memo(EventDotInner);
