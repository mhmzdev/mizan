"use client";

import React, { useState, useCallback, useRef } from "react";
import { TimelineEvent } from "@/types";
import { YEAR_START } from "@/utils/constants";
import { formatYear } from "@/utils/yearUtils";
import { useNotesStore } from "@/stores/notesStore";
import { EventCluster } from "@/utils/clusterEvents";

interface EventDotProps {
  cluster: EventCluster;
  pxPerYear: number;
}

/** Max rows shown in the cluster popover before "+ N more" */
const MAX_LIST = 12;

function EventDotInner({ cluster, pxPerYear }: EventDotProps) {
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { events, centerYear } = cluster;
  const count    = events.length;
  const isSingle = count === 1;

  const leftPx = (centerYear - YEAR_START) * pxPerYear + pxPerYear / 2;

  /* Keep the popover alive while the mouse travels dot → list gap */
  const handleEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }, []);
  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setHovered(false), 150);
  }, []);

  const openNote = useCallback((ev: TimelineEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    useNotesStore.getState().openDrawer(ev.year, undefined, ev.title);
  }, []);

  const visible  = events.slice(0, MAX_LIST);
  const overflow = count - MAX_LIST;

  return (
    <div
      className="absolute -translate-x-1/2"
      style={{ left: leftPx, top: 40, zIndex: hovered ? 50 : 10 }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {isSingle ? (
        /* ── Single event ─────────────────────────────────────────── */
        <>
          <div
            onClick={(e) => openNote(events[0], e)}
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

          {/* Title + year label */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-300"
            style={{ top: hovered ? 62 : 50, opacity: hovered ? 1 : 0, width: 160 }}
          >
            <p className="text-no-text text-[13px] uppercase tracking-widest font-semibold text-center leading-snug">
              {events[0].title}
            </p>
            <p className="text-no-muted text-[12px] font-mono mt-1">
              {formatYear(events[0].year)}
            </p>
          </div>
        </>
      ) : (
        /* ── Cluster ──────────────────────────────────────────────── */
        <>
          {/* Cluster dot */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-full transition-all duration-300 ease-out flex items-center justify-center cursor-default select-none"
            style={{
              width:      hovered ? 52 : 18,
              height:     hovered ? 52 : 18,
              background: hovered ? "rgba(116,160,255,0.07)" : "rgba(116,160,255,0.10)",
              border:     hovered ? "1.5px solid rgba(116,160,255,0.45)" : "1.5px solid rgba(116,160,255,0.50)",
              boxShadow:  hovered
                ? "0 0 0 5px rgba(116,160,255,0.06), 0 12px 32px rgba(0,0,0,0.6)"
                : "0 0 8px 2px rgba(116,160,255,0.12)",
            }}
          >
            {!hovered && (
              <span className="text-no-blue text-[8px] font-bold font-mono leading-none">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </div>

          {/* Event list popover */}
          <div
            className="absolute left-1/2 -translate-x-1/2 transition-all duration-200"
            style={{
              top: 62,
              width: 210,
              opacity: hovered ? 1 : 0,
              pointerEvents: hovered ? "auto" : "none",
              transform: `translateX(-50%) translateY(${hovered ? 0 : -6}px)`,
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <div className="bg-no-panel border border-no-border rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 300 }}>
              {/* Sticky header */}
              <div className="px-3 py-2 border-b border-no-border/60 flex items-center gap-1.5 shrink-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "rgba(116,160,255,0.8)" }}
                />
                <span className="text-no-muted text-[10px] uppercase tracking-[0.12em] font-semibold">
                  {count} events
                </span>
              </div>

              {/* Scrollable event rows */}
              <div className="overflow-y-auto">
                {visible.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => openNote(ev, e)}
                    className="w-full text-left px-3 py-2 hover:bg-no-card/70 transition-colors border-b border-no-border/30 last:border-b-0 group"
                  >
                    <p className="text-no-text text-[12px] font-medium truncate leading-snug group-hover:text-no-blue transition-colors">
                      {ev.title}
                    </p>
                    <p className="text-no-muted text-[10px] font-mono mt-0.5">
                      {formatYear(ev.year)}
                    </p>
                  </button>
                ))}

                {overflow > 0 && (
                  <div className="px-3 py-2 text-no-muted/60 text-[10px] font-mono">
                    +{overflow} more in this period
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const EventDot = React.memo(EventDotInner);
