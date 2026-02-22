"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TimelineContainer } from "@/components/Timeline/TimelineContainer";
import { NotesPanel } from "@/components/Notes/NotesPanel";
import { NoteDrawer } from "@/components/Notes/NoteDrawer";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
import { TimelineEvent } from "@/types";

export default function Home() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const loadNotes     = useNotesStore((s) => s.loadNotes);
  const loadTimelines = useNotesStore((s) => s.loadTimelines);

  // Load events
  useEffect(() => {
    import("@/data/events.json").then((mod) => {
      setEvents(mod.default as TimelineEvent[]);
    });
  }, []);

  // Load persisted data from IndexedDB
  useEffect(() => { loadTimelines(); loadNotes(); }, [loadNotes, loadTimelines]);

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

  // Keyboard shortcuts: 1=centuries, 2=decades, 3=years
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const { setTargetPxPerYear } = useTimelineStore.getState();
      if (e.key === "1") setTargetPxPerYear(5);    // centuries
      if (e.key === "2") setTargetPxPerYear(50);   // decades
      if (e.key === "3") setTargetPxPerYear(500);  // years
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

      {/* Main content: [Notes] [Timeline] [Timeline controls] */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        <NotesPanel />
        <NoteDrawer />
        <TimelineContainer eventsByYear={eventsByYear} />
        <Sidebar />
      </div>
    </div>
  );
}
