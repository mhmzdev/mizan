"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TimelineContainer } from "@/components/Timeline/TimelineContainer";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { useTimelineStore } from "@/stores/timelineStore";
import { TimelineEvent } from "@/types";

export default function Home() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  // Load events
  useEffect(() => {
    import("@/data/events.json").then((mod) => {
      setEvents(mod.default as TimelineEvent[]);
    });
  }, []);

  // Build year → events lookup map
  const eventsByYear = useMemo(() => {
    const map = new Map<number, TimelineEvent[]>();
    for (const event of events) {
      const arr = map.get(event.year);
      if (arr) {
        arr.push(event);
      } else {
        map.set(event.year, [event]);
      }
    }
    return map;
  }, [events]);

  // Keyboard shortcuts for mode switching
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const setMode = useTimelineStore.getState().setMode;
      if (e.key === "1") setMode("centuries");
      if (e.key === "2") setMode("decades");
      if (e.key === "3") setMode("years");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-12 border-b border-white/15 flex items-center px-5 shrink-0 bg-black z-50 relative">
        <h1 className="text-white/90 text-base font-mono tracking-wider">
          MIZAN — INFINITE TIMELINE
        </h1>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        <TimelineContainer eventsByYear={eventsByYear} />
        <Sidebar />
      </div>
    </div>
  );
}
