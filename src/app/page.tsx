"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link2, Check, ChevronLeft, ChevronRight, StickyNote, Layers } from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
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

const PANEL_W = 208; // w-52 = 13rem = 208 px
const PANEL_T = { type: "tween" as const, duration: 0.22, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

export default function Home() {
  const [events,      setEvents]      = useState<TimelineEvent[]>([]);
  const [viewCopied,  setViewCopied]  = useState(false);

  // Panel open/close (desktop/tablet)
  const [notesOpen,   setNotesOpen]   = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Mobile state
  const [isMobile,    setIsMobile]    = useState(false);
  const [mobileSheet, setMobileSheet] = useState<"notes" | "sidebar" | null>(null);

  const loadNotes     = useNotesStore((s) => s.loadNotes);
  const loadTimelines = useNotesStore((s) => s.loadTimelines);
  const drawerOpen    = useNotesStore((s) => s.drawerOpen);

  const dragControls = useDragControls();

  useUrlSync();

  // Load events chunk
  useEffect(() => {
    import("@/data/events.json").then((mod) => {
      setEvents(mod.default as TimelineEvent[]);
    });
  }, []);

  // Load DB + handle ?note= deep link
  useEffect(() => {
    Promise.all([loadTimelines(), loadNotes()]).then(() => {
      if (typeof window === "undefined") return;
      const noteIdStr = new URLSearchParams(window.location.search).get("note");
      if (!noteIdStr) return;
      const noteId = parseInt(noteIdStr, 10);
      if (isNaN(noteId)) return;
      const note = useNotesStore.getState().notes.find((n) => n.id === noteId);
      if (!note) return;
      useNotesStore.getState().openDrawer(note.year, note.id);
      useTimelineStore.getState().setPendingNav({ year: note.year, zoom: MAX_PX_PER_YEAR });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore panel prefs from localStorage + mobile detection
  useEffect(() => {
    const no = localStorage.getItem("mizan_notes_open");
    const so = localStorage.getItem("mizan_sidebar_open");
    if (no !== null) setNotesOpen(no !== "false");
    if (so !== null) setSidebarOpen(so !== "false");

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleNotes = useCallback(() => {
    setNotesOpen((prev) => {
      const next = !prev;
      localStorage.setItem("mizan_notes_open", String(next));
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("mizan_sidebar_open", String(next));
      return next;
    });
  }, []);

  const eventsByYear = useMemo(() => {
    const map = new Map<number, TimelineEvent[]>();
    for (const event of events) {
      const arr = map.get(event.year);
      if (arr) arr.push(event);
      else map.set(event.year, [event]);
    }
    return map;
  }, [events]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const { drawerOpen, closeDrawer } = useNotesStore.getState();
        if (drawerOpen) { e.preventDefault(); closeDrawer(); return; }
        if (mobileSheet) { setMobileSheet(null); return; }
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const { setTargetPxPerYear } = useTimelineStore.getState();
      if (e.key === "1") setTargetPxPerYear(5);
      if (e.key === "2") setTargetPxPerYear(50);
      if (e.key === "3") setTargetPxPerYear(500);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileSheet]);

  function handleCopyViewLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setViewCopied(true);
      setTimeout(() => setViewCopied(false), 2000);
    });
  }

  // Close mobile sheet when note drawer opens
  useEffect(() => {
    if (drawerOpen && isMobile) setMobileSheet(null);
  }, [drawerOpen, isMobile]);

  // NoteDrawer left offset tracks the notes panel width
  const notesPanelWidth = isMobile ? 0 : (notesOpen ? PANEL_W : 0);

  return (
    <div className="h-screen flex flex-col bg-no-bg">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-no-border flex items-center px-5 shrink-0 bg-no-panel z-50 relative">
        <h1 className="text-no-text/70 text-[11px] font-mono tracking-[0.25em] uppercase">
          Mizan — The Balance of Time & Thought
        </h1>
        <button
          onClick={handleCopyViewLink}
          title="Copy view link"
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
        >
          {viewCopied ? <Check size={13} className="text-green-400" /> : <Link2 size={13} />}
        </button>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">

        {/* Left notes panel — desktop/tablet only */}
        {!isMobile && (
          <motion.div
            animate={{ width: notesOpen ? PANEL_W : 0 }}
            transition={PANEL_T}
            className="overflow-hidden shrink-0 h-full z-10"
          >
            <div style={{ width: PANEL_W }} className="h-full">
              <NotesPanel />
            </div>
          </motion.div>
        )}

        {/* Notes collapse/expand tab */}
        {!isMobile && (
          <motion.button
            animate={{ left: notesOpen ? PANEL_W : 0 }}
            transition={PANEL_T}
            onClick={toggleNotes}
            title={notesOpen ? "Collapse notes" : "Expand notes"}
            className="absolute z-30 top-1/2 -translate-y-1/2 h-10 w-[18px] bg-no-panel
                       border-y border-r border-no-border rounded-r-lg
                       flex items-center justify-center
                       text-no-muted hover:text-no-blue hover:bg-no-blue/5 transition-colors"
          >
            <ChevronLeft
              size={10}
              className={`transition-transform duration-200 ${notesOpen ? "" : "rotate-180"}`}
            />
          </motion.button>
        )}

        {/* Note drawer — always present, left follows notes panel */}
        <NoteDrawer panelWidth={notesPanelWidth} isMobile={isMobile} />

        {/* Timeline — takes all remaining space */}
        <TimelineContainer eventsByYear={eventsByYear} />

        {/* Sidebar collapse/expand tab */}
        {!isMobile && (
          <motion.button
            animate={{ right: sidebarOpen ? PANEL_W : 0 }}
            transition={PANEL_T}
            onClick={toggleSidebar}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className="absolute z-30 top-1/2 -translate-y-1/2 h-10 w-[18px] bg-no-panel
                       border-y border-l border-no-border rounded-l-lg
                       flex items-center justify-center
                       text-no-muted hover:text-no-blue hover:bg-no-blue/5 transition-colors"
          >
            <ChevronRight
              size={10}
              className={`transition-transform duration-200 ${sidebarOpen ? "" : "rotate-180"}`}
            />
          </motion.button>
        )}

        {/* Right sidebar — desktop/tablet only */}
        {!isMobile && (
          <motion.div
            animate={{ width: sidebarOpen ? PANEL_W : 0 }}
            transition={PANEL_T}
            className="overflow-hidden shrink-0 h-full z-10"
          >
            <div style={{ width: PANEL_W }} className="h-full">
              <Sidebar />
            </div>
          </motion.div>
        )}

      </div>

      {/* ── Mobile bottom navigation bar ───────────────────────────────────── */}
      {isMobile && (
        <div className="h-14 border-t border-no-border bg-no-panel flex items-center justify-around shrink-0 z-50">
          <button
            onClick={() => setMobileSheet((s) => (s === "notes" ? null : "notes"))}
            className={`flex flex-col items-center gap-1 px-8 py-2 rounded-xl transition-colors ${
              mobileSheet === "notes" ? "text-no-blue" : "text-no-muted hover:text-no-blue"
            }`}
          >
            <StickyNote size={19} />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Notes</span>
          </button>
          <button
            onClick={() => setMobileSheet((s) => (s === "sidebar" ? null : "sidebar"))}
            className={`flex flex-col items-center gap-1 px-8 py-2 rounded-xl transition-colors ${
              mobileSheet === "sidebar" ? "text-no-blue" : "text-no-muted hover:text-no-blue"
            }`}
          >
            <Layers size={19} />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Timelines</span>
          </button>
        </div>
      )}

      {/* ── Mobile bottom sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMobile && mobileSheet && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setMobileSheet(null)}
            />
            <motion.div
              key="sheet"
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              dragSnapToOrigin={false}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 300) setMobileSheet(null);
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="fixed bottom-0 left-0 right-0 h-[80vh] bg-no-panel border-t border-no-border rounded-t-2xl z-[60] overflow-hidden flex flex-col"
            >
              {/* Drag handle — touch here to drag-dismiss */}
              <div
                className="flex justify-center pt-2.5 pb-1 shrink-0 touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-no-border" />
              </div>
              {mobileSheet === "notes" ? <NotesPanel /> : <Sidebar />}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog />
    </div>
  );
}
