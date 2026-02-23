"use client";

import React from "react";
import { Timeline, ZoomMode, TimelineEvent, VisibleRange, Note } from "@/types";
import { YEAR_START } from "@/utils/constants";
import { YearBlock } from "./YearBlock";
import { EventDot } from "./EventDot";
import { NoteDot } from "./NoteDot";
import { HistographyLayer } from "./HistographyLayer";
import { getTickIntervalFromPx } from "@/utils/yearUtils";
import { getTimelineColor, alphaColor } from "@/utils/timelineColors";
import { clusterEvents } from "@/utils/clusterEvents";

interface TimelineTrackProps {
  timeline: Timeline;
  timelineIndex: number;
  mode: ZoomMode;
  pxPerYear: number;
  visibleRange: VisibleRange;
  events: Map<number, TimelineEvent[]>;
  notes: Note[];
  isActive?: boolean;
}

function TimelineTrackInner({ timeline, timelineIndex, mode, pxPerYear, visibleRange, events, notes, isActive }: TimelineTrackProps) {
  const isGlobalTrack = timeline.eventTrack === "global";
  const tickInterval = getTickIntervalFromPx(pxPerYear);
  const { startYear, endYear } = visibleRange;

  const years: number[] = [];
  const alignedStart = Math.floor(startYear / tickInterval) * tickInterval;
  for (let y = alignedStart; y <= endYear; y += tickInterval) {
    if (y >= startYear) years.push(y);
  }

  const visibleEvents: TimelineEvent[] = [];
  if (timeline.eventTrack) {
    for (let y = startYear; y <= endYear; y++) {
      const yearEvents = events.get(y);
      if (yearEvents) {
        for (const ev of yearEvents) {
          if (ev.track === timeline.eventTrack) visibleEvents.push(ev);
        }
      }
    }
  }

  const color = getTimelineColor(timelineIndex);

  return (
    <div
      data-timeline-id={timeline.id}
      className={`relative w-full border-b border-no-border flex-1 transition-colors duration-300 ${isGlobalTrack ? "min-h-[120px]" : "min-h-[80px]"}`}
      style={isActive ? { background: alphaColor(color, 4) } : undefined}
    >
      {/* Left accent stripe — glows with timeline color when active */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 transition-all duration-300"
        style={isActive
          ? { background: alphaColor(color, 55), boxShadow: `2px 0 12px ${alphaColor(color, 25)}` }
          : { background: "transparent" }
        }
      />

      {/* Track label — opaque chip at the top-left, above dots and date labels */}
      <div className="sticky top-2 left-2 z-30 pointer-events-none select-none inline-flex">
        <span
          className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded bg-no-panel border border-no-border/60 transition-colors duration-300"
          style={{ color: isActive ? alphaColor(color, 90) : alphaColor("var(--color-no-muted)", 70) }}
        >
          {timeline.title}
        </span>
      </div>

      {years.map((year) => (
        <YearBlock
          key={year}
          year={year}
          pxPerYear={pxPerYear}
          offsetPx={(year - YEAR_START) * pxPerYear}
          isActive={isActive}
          tickColor={color}
        />
      ))}

      {timeline.eventTrack === "global"
        ? <HistographyLayer events={visibleEvents} pxPerYear={pxPerYear} />
        : clusterEvents(visibleEvents, pxPerYear).map((cluster) => (
            <EventDot key={cluster.events[0].id} cluster={cluster} pxPerYear={pxPerYear} />
          ))
      }

      {(() => {
        const yearCount = new Map<number, number>();
        return notes.map((note) => {
          const idx = yearCount.get(note.year) ?? 0;
          yearCount.set(note.year, idx + 1);
          return <NoteDot key={note.id} note={note} pxPerYear={pxPerYear} stackIndex={idx} color={color} />;
        });
      })()}
    </div>
  );
}

export const TimelineTrack = React.memo(TimelineTrackInner);
