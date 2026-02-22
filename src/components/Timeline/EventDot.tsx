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
      {/* Expanding ring */}
      <div
        className="rounded-full transition-all duration-300 ease-out flex items-center justify-center cursor-pointer"
        style={{
          width:      hovered ? 52 : 8,
          height:     hovered ? 52 : 8,
          background: hovered ? "rgba(116,160,255,0.07)" : "rgba(116,160,255,0.80)",
          border:     hovered ? "1.5px solid rgba(116,160,255,0.45)" : "1.5px solid transparent",
          boxShadow:  hovered
            ? "0 0 0 5px rgba(116,160,255,0.06), 0 12px 32px rgba(0,0,0,0.6)"
            : "0 0 6px 1px rgba(116,160,255,0.3)",
        }}
      >
        <div
          className="rounded-full bg-no-blue transition-all duration-300"
          style={{ width: hovered ? 5 : 0, height: hovered ? 5 : 0, opacity: hovered ? 0.8 : 0 }}
        />
      </div>

      {/* Title + year */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-300"
        style={{ top: hovered ? 62 : 50, opacity: hovered ? 1 : 0, width: 160 }}
      >
        <p className="text-no-text text-[11px] uppercase tracking-widest font-semibold text-center leading-snug">
          {event.title}
        </p>
        <p className="text-no-muted text-[10px] font-mono mt-1">
          {formatYear(event.year)}
        </p>
      </div>
    </div>
  );
}

export const EventDot = React.memo(EventDotInner);
