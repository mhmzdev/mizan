"use client";

import React from "react";
import { Timeline, ZoomMode, TimelineEvent, VisibleRange, Note } from "@/types";
import { YEAR_START } from "@/utils/constants";
import { YearBlock } from "./YearBlock";
import { EventDot } from "./EventDot";
import { NoteDot } from "./NoteDot";
import { getTickIntervalFromPx } from "@/utils/yearUtils";

interface TimelineTrackProps {
  timeline: Timeline;
  mode: ZoomMode;
  pxPerYear: number;
  visibleRange: VisibleRange;
  events: Map<number, TimelineEvent[]>;
  notes: Note[];
}

function TimelineTrackInner({
  timeline,
  mode,
  pxPerYear,
  visibleRange,
  events,
  notes,
}: TimelineTrackProps) {
  const tickInterval = getTickIntervalFromPx(pxPerYear);

  // Build array of years to render — only at tick intervals
  const years: number[] = [];
  const { startYear, endYear } = visibleRange;

  const alignedStart = Math.floor(startYear / tickInterval) * tickInterval;
  for (let y = alignedStart; y <= endYear; y += tickInterval) {
    if (y >= startYear) years.push(y);
  }

  // Collect visible events — only in years mode, and only if this timeline is
  // tied to an event track (i.e. one of the two default timelines)
  const visibleEvents: TimelineEvent[] = [];
  if (mode === "years" && timeline.eventTrack) {
    for (let y = startYear; y <= endYear; y++) {
      const yearEvents = events.get(y);
      if (yearEvents) {
        for (const ev of yearEvents) {
          if (ev.track === timeline.eventTrack) visibleEvents.push(ev);
        }
      }
    }
  }

  return (
    <div className="relative w-full border-b border-white/15 flex-1">
      {/* Track label */}
      <div className="sticky top-10 left-2 text-white/50 text-xs uppercase tracking-widest z-10 pointer-events-none select-none inline-block font-medium">
        {timeline.title}
      </div>

      {/* Year ticks and labels */}
      {years.map((year) => (
        <YearBlock
          key={year}
          year={year}
          pxPerYear={pxPerYear}
          offsetPx={(year - YEAR_START) * pxPerYear}
        />
      ))}

      {/* Event dots (seed data) */}
      {visibleEvents.map((ev) => (
        <EventDot key={ev.id} event={ev} mode={mode} />
      ))}

      {/* Note dots — stacked vertically per year */}
      {(() => {
        const yearCount = new Map<number, number>();
        return notes.map((note) => {
          const idx = yearCount.get(note.year) ?? 0;
          yearCount.set(note.year, idx + 1);
          return (
            <NoteDot key={note.id} note={note} pxPerYear={pxPerYear} stackIndex={idx} />
          );
        });
      })()}
    </div>
  );
}

export const TimelineTrack = React.memo(TimelineTrackInner);
