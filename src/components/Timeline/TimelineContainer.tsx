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
import { useNotesStore } from "@/stores/notesStore";
import { getVisibleRangeFromPx } from "@/utils/virtualization";
import { pxToYearContinuous, formatYear, getModeFromPxPerYear } from "@/utils/yearUtils";
import { PX_PER_YEAR, YEAR_START, YEAR_END, TOTAL_YEARS, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR } from "@/utils/constants";
import { TimelineTrack } from "./TimelineTrack";
import { TimelineEvent, Note } from "@/types";

const ANIMATION_DURATION = 400; // ms — sidebar button transitions

// Zoom feel constants
const ZOOM_SENSITIVITY = 0.003; // log-space nudge per deltaY unit — lower = slower zoom
const ZOOM_LERP       = 0.1;   // fraction to close per frame — lower = smoother/slower coast
const LOG_MIN = Math.log(MIN_PX_PER_YEAR);
const LOG_MAX = Math.log(MAX_PX_PER_YEAR);

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

interface TimelineContainerProps {
  eventsByYear: Map<number, TimelineEvent[]>;
}

export function TimelineContainer({ eventsByYear }: TimelineContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef   = useRef<HTMLDivElement>(null);

  // Sidebar animation refs
  const isSettingScroll = useRef(false);
  const isAnimatingRef  = useRef(false);
  const animFrameRef    = useRef<number | null>(null);

  // Wheel-zoom momentum refs (log-space lerp)
  const targetLogPxRef  = useRef(Math.log(PX_PER_YEAR.centuries));
  const currentLogPxRef = useRef(Math.log(PX_PER_YEAR.centuries));
  const zoomRafRef      = useRef<number | null>(null);
  const zoomCenterRef   = useRef(-1);  // year to keep fixed during zoom
  const zoomAnchorRef   = useRef(0);   // viewport-relative px where that year is pinned
  const mouseRef        = useRef<{ x: number; y: number } | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  const pxPerYear       = useTimelineStore((s) => s.pxPerYear);
  const targetPxPerYear = useTimelineStore((s) => s.targetPxPerYear);
  const scrollLeft      = useTimelineStore((s) => s.scrollLeft);
  const viewportWidth   = useTimelineStore((s) => s.viewportWidth);
  const pendingNav      = useTimelineStore((s) => s.pendingNav);
  const setScrollLeft   = useTimelineStore((s) => s.setScrollLeft);
  const setViewportWidth = useTimelineStore((s) => s.setViewportWidth);

  const rangeStart = useTimelineStore((s) => s.rangeStart);
  const rangeEnd   = useTimelineStore((s) => s.rangeEnd);
  const rangeActive = rangeStart !== null && rangeEnd !== null;

  const mode = getModeFromPxPerYear(pxPerYear);
  const totalWidth = pxPerYear * TOTAL_YEARS;

  const visibleRange = useMemo(
    () => getVisibleRangeFromPx(scrollLeft, viewportWidth, pxPerYear),
    [scrollLeft, viewportWidth, pxPerYear]
  );

  const hoveredYear = useMemo(() => {
    if (mouse === null) return null;
    return pxToYearContinuous(scrollLeft + mouse.x, pxPerYear);
  }, [mouse, scrollLeft, pxPerYear]);

  // Timelines + notes from store
  const timelines          = useNotesStore((s) => s.timelines);
  const allNotes           = useNotesStore((s) => s.notes);
  const drawerOpen         = useNotesStore((s) => s.drawerOpen);
  const drawerTimelineId   = useNotesStore((s) => s.drawerTimelineId);

  // Per-timeline visible notes map: timelineId → Note[]
  const visibleNotesByTimeline = useMemo(() => {
    const map = new Map<number, Note[]>();
    for (const note of allNotes) {
      if (note.year >= visibleRange.startYear && note.year <= visibleRange.endYear) {
        const arr = map.get(note.timelineId) ?? [];
        arr.push(note);
        map.set(note.timelineId, arr);
      }
    }
    return map;
  }, [allNotes, visibleRange]);

  // Block scroll-event feedback during both sidebar animation and wheel-zoom loop
  const handleScroll = useCallback(() => {
    if (
      !containerRef.current ||
      isSettingScroll.current ||
      isAnimatingRef.current ||
      zoomRafRef.current !== null
    ) return;
    setScrollLeft(containerRef.current.scrollLeft);
  }, [setScrollLeft]);

  // Initial mount: center on 1 BC in centuries scale
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const vw = containerRef.current.clientWidth;
    const initialPx = PX_PER_YEAR.centuries;
    const initialScroll = Math.max(0, (-1 - YEAR_START) * initialPx - vw / 2);
    isSettingScroll.current = true;
    containerRef.current.scrollLeft = initialScroll;
    useTimelineStore.setState({ scrollLeft: initialScroll, centerYear: -1, viewportWidth: vw });
    requestAnimationFrame(() => { isSettingScroll.current = false; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setViewportWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    setViewportWidth(containerRef.current.clientWidth);
    return () => observer.disconnect();
  }, [setViewportWidth]);

  // Instant navigation from URL deep-link (pendingNav set by useUrlSync / page.tsx)
  useEffect(() => {
    if (!pendingNav || viewportWidth <= 0 || !containerRef.current) return;

    const { year, zoom } = pendingNav;
    const newScroll = Math.max(0, (year - YEAR_START) * zoom - viewportWidth / 2);

    // Cancel any in-flight sidebar animation or wheel-zoom loop
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current   = null;
      isAnimatingRef.current = false;
    }
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }

    // Sync zoom refs so the next wheel gesture continues from here
    currentLogPxRef.current = Math.log(zoom);
    targetLogPxRef.current  = Math.log(zoom);

    // Apply to DOM and store in one shot
    isSettingScroll.current = true;
    containerRef.current.scrollLeft = newScroll;
    requestAnimationFrame(() => { isSettingScroll.current = false; });

    useTimelineStore.setState({
      pxPerYear:  zoom,
      scrollLeft: newScroll,
      centerYear: year,
      pendingNav: null,
    });
  }, [pendingNav, viewportWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sidebar button animation (400 ms ease-out-expo)
  useEffect(() => {
    if (targetPxPerYear === null) return;
    if (!containerRef.current) return;

    // Cancel any wheel-zoom momentum loop
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
    // Cancel any previous sidebar animation
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    isAnimatingRef.current = true;

    const startPx = useTimelineStore.getState().pxPerYear;
    const endPx   = targetPxPerYear;
    const capturedCenter = useTimelineStore.getState().centerYear;
    const startTime = performance.now();
    const container = containerRef.current;

    function tick(now: number) {
      const t      = Math.min((now - startTime) / ANIMATION_DURATION, 1);
      const eased  = easeOutExpo(t);
      const newPx  = startPx + (endPx - startPx) * eased;

      const vw = useTimelineStore.getState().viewportWidth;
      const newScrollLeft  = Math.max(0, (capturedCenter - YEAR_START) * newPx - vw / 2);
      const newCenterYear  = Math.floor((newScrollLeft + vw / 2) / newPx) + YEAR_START;

      isSettingScroll.current = true;
      container.scrollLeft = newScrollLeft;
      requestAnimationFrame(() => { isSettingScroll.current = false; });

      useTimelineStore.setState({ pxPerYear: newPx, scrollLeft: newScrollLeft, centerYear: newCenterYear });

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        // Sync zoom refs so next wheel gesture starts from the correct position
        currentLogPxRef.current = Math.log(endPx);
        targetLogPxRef.current  = Math.log(endPx);
        isAnimatingRef.current  = false;
        animFrameRef.current    = null;
        useTimelineStore.getState().setTargetPxPerYear(null);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current   = null;
        isAnimatingRef.current = false;
      }
    };
  }, [targetPxPerYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel handler: pan (Shift / horizontal swipe) or smooth zoom
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    /**
     * Apply a resolved pxPerYear to DOM + store.
     * Keeps zoomCenterRef (a year) fixed at zoomAnchorRef (viewport-relative px).
     * e.g. anchor = mouseX → the year under the cursor stays under the cursor.
     */
    function applyZoom(newPx: number) {
      const pinnedYear  = zoomCenterRef.current;
      const anchorPx    = zoomAnchorRef.current;
      const vw          = useTimelineStore.getState().viewportWidth;
      const rawScrollLeft = (pinnedYear - YEAR_START) * newPx - anchorPx;
      const newScrollLeft = Math.max(0, rawScrollLeft);
      const newCenter     = Math.floor((newScrollLeft + vw / 2) / newPx) + YEAR_START;

      if (containerRef.current) containerRef.current.scrollLeft = newScrollLeft;
      useTimelineStore.setState({ pxPerYear: newPx, scrollLeft: newScrollLeft, centerYear: newCenter });
    }

    /** Start (or keep running) the momentum lerp loop. */
    function startZoomLoop() {
      if (zoomRafRef.current !== null) return; // already running

      function loop() {
        const diff = targetLogPxRef.current - currentLogPxRef.current;

        if (Math.abs(diff) < 0.0002) {
          // Close enough — snap and stop
          currentLogPxRef.current = targetLogPxRef.current;
          applyZoom(Math.exp(currentLogPxRef.current));
          zoomRafRef.current = null;
          return;
        }

        currentLogPxRef.current += diff * ZOOM_LERP;
        applyZoom(Math.exp(currentLogPxRef.current));
        zoomRafRef.current = requestAnimationFrame(loop);
      }

      zoomRafRef.current = requestAnimationFrame(loop);
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const { deltaX, deltaY, shiftKey } = e;

      // ── Pan: Shift+scroll or native horizontal trackpad swipe ──────────────
      // On Mac, Shift+vertical scroll re-fires as deltaX (deltaY = 0).
      const isPan = shiftKey || Math.abs(deltaX) > Math.abs(deltaY);
      if (isPan) {
        if (!containerRef.current) return;
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
        const newScrollLeft = Math.max(0, containerRef.current.scrollLeft + delta);
        containerRef.current.scrollLeft = newScrollLeft;
        useTimelineStore.getState().setScrollLeft(newScrollLeft);
        return;
      }

      // ── Zoom: plain vertical scroll ────────────────────────────────────────
      if (isAnimatingRef.current) return; // sidebar animation in flight

      // On the first event of a new zoom gesture, capture anchor from cursor (or center)
      if (zoomRafRef.current === null) {
        const state = useTimelineStore.getState();
        const logPx = Math.log(state.pxPerYear);
        currentLogPxRef.current = logPx;
        targetLogPxRef.current  = logPx;

        if (mouseRef.current !== null) {
          // Pin the year under the cursor to the cursor's x position
          const cursorYear = Math.floor((state.scrollLeft + mouseRef.current.x) / state.pxPerYear) + YEAR_START;
          zoomCenterRef.current = cursorYear;
          zoomAnchorRef.current = mouseRef.current.x;
        } else {
          // No cursor — fall back to viewport center
          zoomCenterRef.current = state.centerYear;
          zoomAnchorRef.current = state.viewportWidth / 2;
        }
      }

      // Nudge the target in log-space (perceptually uniform zoom speed)
      targetLogPxRef.current = Math.max(
        LOG_MIN,
        Math.min(LOG_MAX, targetLogPxRef.current - deltaY * ZOOM_SENSITIVITY)
      );

      startZoomLoop();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (zoomRafRef.current !== null) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = null;
      }
    };
  }, []); // refs + getState — no reactive deps needed

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setMouse(pos);
    mouseRef.current = pos;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMouse(null);
    mouseRef.current = null;
  }, []);

  /**
   * Click to open the note drawer pre-filled with the clicked year.
   * A 5 px drag-guard prevents false fires from scroll/drag gestures.
   */
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore if the pointer moved more than 5 px — it was a scroll/drag gesture
    if (mouseDownPosRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      if (dx * dx + dy * dy > 25) return;
    }

    const state = useTimelineStore.getState();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedYear = Math.floor((state.scrollLeft + clickX) / state.pxPerYear) + YEAR_START;
    const clampedYear = Math.max(YEAR_START, Math.min(YEAR_END, clickedYear));

    // Walk up from the click target to find which timeline track was clicked
    let el = e.target as HTMLElement | null;
    let clickedTimelineId: number | null = null;
    while (el && el !== e.currentTarget) {
      if (el.dataset.timelineId) {
        clickedTimelineId = parseInt(el.dataset.timelineId, 10);
        break;
      }
      el = el.parentElement;
    }

    const notesStore = useNotesStore.getState();
    if (clickedTimelineId !== null) notesStore.setLastTimelineId(clickedTimelineId);
    notesStore.openDrawer(clampedYear);
  }, []);

  const labelOffsetX =
    mouse !== null && viewportWidth > 0 && mouse.x > viewportWidth - 120
      ? -108
      : 8;

  return (
    <div
      ref={wrapperRef}
      className="relative flex-1 min-w-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={(e) => { mouseDownPosRef.current = { x: e.clientX, y: e.clientY }; }}
      onClick={handleTimelineClick}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden timeline-scroll cursor-none"
        onScroll={handleScroll}
      >
        <div className="relative flex flex-col" style={{ width: totalWidth, minHeight: "100%" }}>

          {/* ── Start-of-timeline boundary ─────────────────────────────── */}
          <div className="absolute top-0 bottom-0 left-0 w-px bg-no-muted/30 pointer-events-none z-20" />
          <div className="absolute top-3 left-2 pointer-events-none z-20 select-none">
            <div className="text-no-muted/75 text-[13px] font-mono font-semibold whitespace-nowrap">
              {formatYear(YEAR_START)}
            </div>
            <div className="text-no-muted/35 text-[11px] uppercase tracking-[0.12em] mt-0.5 whitespace-nowrap">
              Start of timeline
            </div>
          </div>

          {/* ── End-of-timeline boundary ───────────────────────────────── */}
          <div className="absolute top-0 bottom-0 right-0 w-px bg-no-muted/30 pointer-events-none z-20" />
          <div className="absolute top-3 right-2 pointer-events-none z-20 select-none text-right">
            <div className="text-no-muted/75 text-[13px] font-mono font-semibold whitespace-nowrap">
              {formatYear(YEAR_END)}
            </div>
            <div className="text-no-muted/35 text-[11px] uppercase tracking-[0.12em] mt-0.5 whitespace-nowrap">
              End of timeline
            </div>
          </div>

          {/* ── Date-range overlays ────────────────────────────────────── */}
          {rangeActive && (() => {
            const startPx = (rangeStart! - YEAR_START) * pxPerYear;
            const endPx   = (rangeEnd!   - YEAR_START + 1) * pxPerYear;
            return (
              <>
                {/* Dim: left of range */}
                {startPx > 0 && (
                  <div
                    className="absolute top-0 bottom-0 left-0 pointer-events-none z-[21]"
                    style={{ width: startPx, background: "rgba(10,12,14,0.62)" }}
                  />
                )}
                {/* Dim: right of range */}
                {endPx < totalWidth && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-[21]"
                    style={{ left: endPx, right: 0, background: "rgba(10,12,14,0.62)" }}
                  />
                )}
                {/* Range start boundary line */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-[22]"
                  style={{
                    left: startPx,
                    background: "rgba(116,160,255,0.7)",
                    boxShadow: "2px 0 10px rgba(116,160,255,0.25)",
                  }}
                />
                {/* Range end boundary line */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-[22]"
                  style={{
                    left: endPx,
                    background: "rgba(116,160,255,0.7)",
                    boxShadow: "-2px 0 10px rgba(116,160,255,0.25)",
                  }}
                />
              </>
            );
          })()}

          {timelines.map((timeline, idx) => (
            <TimelineTrack
              key={timeline.id}
              timeline={timeline}
              timelineIndex={idx}
              mode={mode}
              pxPerYear={pxPerYear}
              visibleRange={visibleRange}
              events={eventsByYear}
              notes={visibleNotesByTimeline.get(timeline.id!) ?? []}
              isActive={drawerOpen && timeline.id === drawerTimelineId}
            />
          ))}
        </div>
      </div>

      {mouse !== null && hoveredYear !== null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-[45]"
          style={{ left: mouse.x }}
        >
          <div className="w-px h-full bg-no-blue/30" />
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-no-blue shadow-[0_0_10px_3px_rgba(116,160,255,0.35)]"
            style={{ top: mouse.y, left: 0.5 }}
          />
          <div
            className="absolute -translate-y-1/2 bg-no-panel/90 px-2 py-0.5 rounded-md text-no-blue text-xs font-mono whitespace-nowrap"
            style={{ top: mouse.y, left: labelOffsetX }}
          >
            {formatYear(hoveredYear)}
          </div>
        </div>
      )}
    </div>
  );
}
