"use client";

import React, { useState } from "react";
import { TimelineEvent, ZoomMode } from "@/types";
import { PX_PER_YEAR, YEAR_START } from "@/utils/constants";

interface EventDotProps {
  event: TimelineEvent;
  mode: ZoomMode;
}

function EventDotInner({ event, mode }: EventDotProps) {
  const [hovered, setHovered] = useState(false);

  // Only render dots in year mode
  if (mode !== "years") return null;

  const pxPerYear = PX_PER_YEAR[mode];
  const leftPx = (event.year - YEAR_START) * pxPerYear + pxPerYear / 2;

  return (
    <div
      className="absolute"
      style={{ left: leftPx, top: 40 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-3 h-3 rounded-full bg-blue-400 hover:bg-blue-300 cursor-pointer transition-colors -translate-x-1/2" />

      {hovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-zinc-900 border border-white/20 rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none">
          <p className="text-white text-sm font-medium">{event.title}</p>
          {event.description && (
            <p className="text-white/70 text-xs mt-1">{event.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

export const EventDot = React.memo(EventDotInner);
