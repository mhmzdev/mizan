"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link2, Check } from "lucide-react";
import { TimelineContainer } from "@/components/Timeline/TimelineContainer";
import { NotesPanel } from "@/components/Notes/NotesPanel";
import { NoteDrawer } from "@/components/Notes/NoteDrawer";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
import { useUrlSync } from "@/hooks/useUrlSync";
import { MAX_PX_PER_YEAR } from "@/utils/constants";
import { TimelineEvent } from "@/types";

export default function Home() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [viewCopied, setViewCopied] = useState(false);

  const loadNotes     = useNotesStore((s) => s.loadNotes);
  const loadTimelines = useNotesStore((s) => s.loadTimelines);

  // Activate URL ↔ store sync (view state + note deep links)
  useUrlSync();

  // Load events chunk
  useEffect(() => {
    import("@/data/events.json").then((mod) => {
      setEvents(mod.default as TimelineEvent[]);
    });
  }, []);

  // Load notes + timelines, then handle ?note= deep link
  useEffect(() => {
    Promise.all([loadTimelines(), loadNotes()]).then(() => {
      if (typeof window === "undefined") return;
      const noteIdStr = new URLSearchParams(window.location.search).get("note");
      if (!noteIdStr) return;
      const noteId = parseInt(noteIdStr, 10);
      if (isNaN(noteId)) return;

      const note = useNotesStore.getState().notes.find((n) => n.id === noteId);
      if (!note) return;

      // Open the drawer for this note and jump the timeline to its year
      useNotesStore.getState().openDrawer(note.year, note.id);
      useTimelineStore.getState().setPendingNav({ year: note.year, zoom: MAX_PX_PER_YEAR });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const eventsByYear = useMemo(() => {
    const map = new Map<number, TimelineEvent[]>();
    for (const event of events) {
      const arr = map.get(event.year);
      if (arr) arr.push(event);
      else map.set(event.year, [event]);
    }
    return map;
  }, [events]);

  // Keyboard shortcuts: Escape=close drawer, 1=centuries, 2=decades, 3=years
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape closes the note drawer regardless of focus
      if (e.key === "Escape") {
        const { drawerOpen, closeDrawer } = useNotesStore.getState();
        if (drawerOpen) { e.preventDefault(); closeDrawer(); return; }
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const { setTargetPxPerYear } = useTimelineStore.getState();
      if (e.key === "1") setTargetPxPerYear(5);
      if (e.key === "2") setTargetPxPerYear(50);
      if (e.key === "3") setTargetPxPerYear(500);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleCopyViewLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setViewCopied(true);
      setTimeout(() => setViewCopied(false), 2000);
    });
  }

  return (
    <div className="h-screen flex flex-col bg-no-bg">
      {/* Header */}
      <header className="h-12 border-b border-no-border flex items-center px-5 shrink-0 bg-no-panel z-50 relative">
        <h1 className="text-no-text/70 text-[11px] font-mono tracking-[0.25em] uppercase">
          Mizan — Infinite Timeline
        </h1>

        {/* Copy current view link */}
        <button
          onClick={handleCopyViewLink}
          title="Copy view link"
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
        >
          {viewCopied
            ? <Check size={13} className="text-green-400" />
            : <Link2 size={13} />
          }
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        <NotesPanel />
        <NoteDrawer />
        <TimelineContainer eventsByYear={eventsByYear} />
        <Sidebar />
      </div>

      {/* Global confirm dialog */}
      <ConfirmDialog />
    </div>
  );
}
