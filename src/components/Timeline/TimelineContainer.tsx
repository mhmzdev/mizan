"use client";

import React, {
  useRef,
  useCallback,
  useLayoutEffect,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { getVisibleRange } from "@/utils/virtualization";
import { getTotalWidth, pxToYear, formatYear, yearToPx } from "@/utils/yearUtils";
import { TimelineTrack } from "./TimelineTrack";
import { tracks } from "@/data/tracks";
import { TimelineEvent } from "@/types";

interface TimelineContainerProps {
  eventsByYear: Map<number, TimelineEvent[]>;
}

export function TimelineContainer({ eventsByYear }: TimelineContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSettingScroll = useRef(false);
  const hasMounted = useRef(false);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  const mode = useTimelineStore((s) => s.mode);
  const scrollLeft = useTimelineStore((s) => s.scrollLeft);
  const viewportWidth = useTimelineStore((s) => s.viewportWidth);
  const setScrollLeft = useTimelineStore((s) => s.setScrollLeft);
  const setViewportWidth = useTimelineStore((s) => s.setViewportWidth);

  const totalWidth = getTotalWidth(mode);

  const visibleRange = useMemo(
    () => getVisibleRange(scrollLeft, viewportWidth, mode),
    [scrollLeft, viewportWidth, mode]
  );

  // The year under the cursor — combines viewport mouse position with scroll offset
  const hoveredYear = useMemo(() => {
    if (mouse === null) return null;
    return pxToYear(scrollLeft + mouse.x, mode);
  }, [mouse, scrollLeft, mode]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || isSettingScroll.current) return;
    setScrollLeft(containerRef.current.scrollLeft);
  }, [setScrollLeft]);

  // On first mount: center the timeline on 1 BC (internal year -1)
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const vw = containerRef.current.clientWidth;
    const initialScroll = Math.max(0, yearToPx(-1, "centuries") - vw / 2);
    isSettingScroll.current = true;
    containerRef.current.scrollLeft = initialScroll;
    useTimelineStore.setState({ scrollLeft: initialScroll, centerYear: -1, viewportWidth: vw });
    requestAnimationFrame(() => {
      isSettingScroll.current = false;
      hasMounted.current = true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On mode change: sync store scrollLeft to DOM (skip on initial mount)
  useLayoutEffect(() => {
    if (!containerRef.current || !hasMounted.current) return;
    isSettingScroll.current = true;
    containerRef.current.scrollLeft = scrollLeft;
    requestAnimationFrame(() => {
      isSettingScroll.current = false;
    });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    setViewportWidth(containerRef.current.clientWidth);
    return () => observer.disconnect();
  }, [setViewportWidth]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => setMouse(null), []);

  // Clamp label so it doesn't overflow the right edge
  const labelOffsetX =
    mouse !== null && viewportWidth > 0 && mouse.x > viewportWidth - 120
      ? -108
      : 8;

  return (
    // Wrapper is position:relative so the cursor overlay is in viewport space
    <div
      className="relative flex-1 min-w-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Scroll container — fills the wrapper */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden timeline-scroll cursor-none"
        onScroll={handleScroll}
      >
        <div className="flex flex-col" style={{ width: totalWidth, minHeight: "100%" }}>
          {tracks.map((track) => (
            <TimelineTrack
              key={track.id}
              track={track}
              mode={mode}
              visibleRange={visibleRange}
              events={eventsByYear}
            />
          ))}
        </div>
      </div>

      {/* Cursor line — positioned in viewport space (not scroll space) */}
      {mouse !== null && hoveredYear !== null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: mouse.x }}
        >
          {/* The line */}
          <div className="w-px h-full bg-white/35" />

          {/* Dot tracking the vertical cursor position */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.25)]"
            style={{ top: mouse.y, left: 0.5 }}
          />

          {/* Year label */}
          <div
            className="absolute top-3 bg-black/80 border border-white/20 px-2 py-0.5 rounded text-white text-xs font-mono whitespace-nowrap"
            style={{ left: labelOffsetX }}
          >
            {formatYear(hoveredYear)}
          </div>
        </div>
      )}
    </div>
  );
}
