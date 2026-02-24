"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link2, Check, ChevronLeft, ChevronRight, StickyNote, Layers, Sun, Moon, Play, HardDrive, Globe } from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import dynamic from "next/dynamic";
import { TimelineContainer } from "@/components/Timeline/TimelineContainer";
import { NotesPanel } from "@/components/Notes/NotesPanel";
import { NoteDrawer } from "@/components/Notes/NoteDrawer";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExportImportDialog } from "@/components/ui/ExportImportDialog";
import { UndoToast } from "@/components/ui/UndoToast";
import { MizanLogo } from "@/components/ui/MizanLogo";
import { TourOverlay } from "@/components/Tour/TourOverlay";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useTourStore } from "@/stores/tourStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
import { useMapStore } from "@/stores/mapStore";
import { useUrlSync } from "@/hooks/useUrlSync";
import { useTheme } from "@/hooks/useTheme";
import { MAX_PX_PER_YEAR } from "@/utils/constants";
import { TimelineEvent } from "@/types";

const MapView = dynamic(() => import("@/components/Map/MapView"), { ssr: false });

const MIN_PANEL_W = 208; // minimum / default panel width
const MAX_PANEL_W = 400; // maximum panel width
const PANEL_T = { type: "tween" as const, duration: 0.22, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };
const INSTANT   = { duration: 0 } as const;

export default function Home() {
  const [events,      setEvents]      = useState<TimelineEvent[]>([]);
  const [viewCopied,         setViewCopied]         = useState(false);
  const [exportImportOpen,   setExportImportOpen]   = useState(false);
  const [isLoading,          setIsLoading]          = useState(true);
  const loadedRef = useRef({ events: false, db: false, startTime: Date.now() });

  // Panel open/close (desktop/tablet)
  const [notesOpen,    setNotesOpen]   = useState(true);
  const [sidebarOpen,  setSidebarOpen] = useState(true);

  // Panel widths — resizable between MIN_PANEL_W and MAX_PANEL_W
  const [notesWidth,   setNotesWidth]   = useState(MIN_PANEL_W);
  const [sidebarWidth, setSidebarWidth] = useState(MIN_PANEL_W);
  const isResizingRef = useRef(false);

  // Mobile state
  const [isMobile,    setIsMobile]    = useState(false);
  const [mobileSheet, setMobileSheet] = useState<"notes" | "sidebar" | null>(null);

  const loadNotes     = useNotesStore((s) => s.loadNotes);
  const loadTimelines = useNotesStore((s) => s.loadTimelines);
  const drawerOpen    = useNotesStore((s) => s.drawerOpen);

  const viewMode    = useMapStore((s) => s.viewMode);
  const setViewMode = useMapStore((s) => s.setViewMode);

  // Persist timeline scroll position across map ↔ timeline switches.
  // TimelineContainer's useLayoutEffect always resets to year 0 on mount,
  // so we save the last known position before going to map and restore it after.
  const savedTimelinePos = useRef<{year: number; zoom: number} | null>(null);
  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    if (prevViewMode.current === "timeline" && viewMode === "map") {
      // Save position before TimelineContainer unmounts
      const { centerYear, pxPerYear } = useTimelineStore.getState();
      savedTimelinePos.current = { year: centerYear, zoom: pxPerYear };
    } else if (prevViewMode.current === "map" && viewMode === "timeline") {
      // TimelineContainer just mounted and reset to year 0. After its
      // useLayoutEffect sets the default pendingNav, we override it so the
      // landing animation targets the saved position instead.
      if (savedTimelinePos.current) {
        const saved = savedTimelinePos.current;
        setTimeout(() => {
          useTimelineStore.getState().setPendingNav({ year: saved.year, zoom: saved.zoom });
        }, 0);
      }
    }
    prevViewMode.current = viewMode;
  }, [viewMode]);

  const tourActive = useTourStore((s) => s.active);
  const tourStep   = useTourStore((s) => s.step);
  const startTour  = useTourStore((s) => s.start);

  const dragControls = useDragControls();

  useUrlSync();
  const { theme, toggleTheme } = useTheme();

  // Dismiss loading screen once both events + DB are ready (min 700 ms for polish)
  const checkAllLoaded = useCallback(() => {
    const s = loadedRef.current;
    if (!s.events || !s.db) return;
    const elapsed   = Date.now() - s.startTime;
    const remaining = Math.max(0, 700 - elapsed);
    setTimeout(() => setIsLoading(false), remaining);
  }, []);

  // Load events chunk
  useEffect(() => {
    import("@/data/events.json").then((mod) => {
      setEvents(mod.default as TimelineEvent[]);
      loadedRef.current.events = true;
      checkAllLoaded();
    });
  }, [checkAllLoaded]);

  // Load DB + handle ?note= deep link
  useEffect(() => {
    Promise.all([loadTimelines(), loadNotes()]).then(() => {
      loadedRef.current.db = true;
      checkAllLoaded();
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
  }, [checkAllLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore panel prefs from localStorage + mobile detection
  useEffect(() => {
    const no = localStorage.getItem("mizan_notes_open");
    const so = localStorage.getItem("mizan_sidebar_open");
    if (no !== null) setNotesOpen(no !== "false");
    if (so !== null) setSidebarOpen(so !== "false");

    const nw = localStorage.getItem("mizan_notes_width");
    const sw = localStorage.getItem("mizan_sidebar_width");
    if (nw !== null) setNotesWidth(Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, parseInt(nw))));
    if (sw !== null) setSidebarWidth(Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, parseInt(sw))));

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

  function startResizeNotes(e: React.MouseEvent) {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    const startX = e.clientX;
    const startW = notesWidth;
    function onMove(ev: MouseEvent) {
      setNotesWidth(Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, startW + ev.clientX - startX)));
    }
    function onUp(ev: MouseEvent) {
      const w = Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, startW + ev.clientX - startX));
      setNotesWidth(w);
      localStorage.setItem("mizan_notes_width", String(w));
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function startResizeSidebar(e: React.MouseEvent) {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    const startX = e.clientX;
    const startW = sidebarWidth;
    function onMove(ev: MouseEvent) {
      setSidebarWidth(Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, startW - (ev.clientX - startX))));
    }
    function onUp(ev: MouseEvent) {
      const w = Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, startW - (ev.clientX - startX)));
      setSidebarWidth(w);
      localStorage.setItem("mizan_sidebar_width", String(w));
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

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

  // Ensure the right panel is visible for each tour step
  useEffect(() => {
    if (!tourActive) return;
    if (tourStep === 1) {
      // Step 2: sidebar (timelines)
      if (isMobile) setMobileSheet("sidebar");
      else setSidebarOpen(true);
    } else if (tourStep === 2) {
      // Step 3: notes panel
      if (isMobile) setMobileSheet("notes");
      else setNotesOpen(true);
    } else {
      // Step 1: timeline — close sheets so timeline is unobstructed
      if (isMobile) setMobileSheet(null);
    }
  }, [tourActive, tourStep, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // NoteDrawer left offset tracks the notes panel width (instant during resize)
  const notesPanelWidth = isMobile ? 0 : (notesOpen ? notesWidth : 0);
  // Read ref at render time — safe because setWidth triggers re-renders
  const panelT = isResizingRef.current ? INSTANT : PANEL_T;

  return (
    <div className="h-[100dvh] flex flex-col bg-no-bg">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-no-border flex items-center px-5 shrink-0 bg-no-panel z-50 relative">
        <MizanLogo />
        <button
          onClick={startTour}
          title="Take the tour"
          className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
        >
          <Play size={12} />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode(viewMode === "map" ? "timeline" : "map")}
            title={viewMode === "map" ? "Switch to timeline" : "Switch to map"}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              viewMode === "map"
                ? "text-no-blue bg-no-blue/10"
                : "text-no-muted hover:text-no-blue hover:bg-no-blue/10"
            }`}
          >
            <Globe size={13} />
          </button>
          <button
            onClick={() => setExportImportOpen(true)}
            title="Export / Import notes"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
          >
            <HardDrive size={13} />
          </button>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
          >
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <button
            onClick={handleCopyViewLink}
            title="Copy view link"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
          >
            {viewCopied ? <Check size={13} className="text-green-400" /> : <Link2 size={13} />}
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">

        {/* Left notes panel — desktop/tablet only */}
        {!isMobile && (
          <motion.div
            animate={{ width: notesOpen ? notesWidth : 0 }}
            transition={panelT}
            className="overflow-hidden shrink-0 h-full z-10"
          >
            <div style={{ width: notesWidth }} className="h-full">
              <NotesPanel events={events} />
            </div>
          </motion.div>
        )}

        {/* Notes resize handle — drag to widen/narrow */}
        {!isMobile && notesOpen && (
          <div
            className="absolute top-0 bottom-0 z-[25] cursor-col-resize select-none group"
            style={{ left: notesWidth - 5, width: 10 }}
            onMouseDown={startResizeNotes}
          >
            <div className="absolute inset-y-0 left-[4px] w-px bg-no-blue/0 group-hover:bg-no-blue/50 transition-colors duration-150" />
          </div>
        )}

        {/* Notes collapse/expand tab */}
        {!isMobile && (
          <motion.button
            animate={{ left: notesOpen ? notesWidth : 0 }}
            transition={panelT}
            onClick={toggleNotes}
            title={notesOpen ? "Collapse notes" : "Expand notes"}
            className="absolute z-30 top-1/2 -translate-y-1/2 h-10 w-[18px] bg-no-panel
                       border-y border-r border-no-border rounded-r-lg
                       flex items-center justify-center
                       text-no-muted hover:text-white hover:bg-no-blue hover:border-no-blue transition-colors"
          >
            <ChevronLeft
              size={10}
              className={`transition-transform duration-200 ${notesOpen ? "" : "rotate-180"}`}
            />
          </motion.button>
        )}

        {/* Note drawer — always present, left follows notes panel */}
        <NoteDrawer panelWidth={notesPanelWidth} isMobile={isMobile} instantLeft={isResizingRef.current} />

        {/* Timeline / Map — takes all remaining space */}
        <div data-tour="tour-timeline" className="flex flex-1 min-w-0 overflow-hidden">
          {viewMode === "map"
            ? <MapView events={events} />
            : <TimelineContainer eventsByYear={eventsByYear} />
          }
        </div>

        {/* Sidebar collapse/expand tab */}
        {!isMobile && (
          <motion.button
            animate={{ right: sidebarOpen ? sidebarWidth : 0 }}
            transition={panelT}
            onClick={toggleSidebar}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className="absolute z-30 top-1/2 -translate-y-1/2 h-10 w-[18px] bg-no-panel
                       border-y border-l border-no-border rounded-l-lg
                       flex items-center justify-center
                       text-no-muted hover:text-white hover:bg-no-blue hover:border-no-blue transition-colors"
          >
            <ChevronRight
              size={10}
              className={`transition-transform duration-200 ${sidebarOpen ? "" : "rotate-180"}`}
            />
          </motion.button>
        )}

        {/* Sidebar resize handle — drag to widen/narrow */}
        {!isMobile && sidebarOpen && (
          <div
            className="absolute top-0 bottom-0 z-[25] cursor-col-resize select-none group"
            style={{ right: sidebarWidth - 5, width: 10 }}
            onMouseDown={startResizeSidebar}
          >
            <div className="absolute inset-y-0 right-[4px] w-px bg-no-blue/0 group-hover:bg-no-blue/50 transition-colors duration-150" />
          </div>
        )}

        {/* Right sidebar — desktop/tablet only */}
        {!isMobile && (
          <motion.div
            animate={{ width: sidebarOpen ? sidebarWidth : 0 }}
            transition={panelT}
            className="overflow-hidden shrink-0 h-full z-10"
          >
            <div style={{ width: sidebarWidth }} className="h-full">
              <Sidebar />
            </div>
          </motion.div>
        )}

      </div>

      {/* ── Mobile bottom navigation bar ───────────────────────────────────── */}
      {isMobile && (
        <div
          className="border-t border-no-border bg-no-panel shrink-0 z-50"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="h-14 flex items-center justify-around">
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
              {mobileSheet === "notes" ? <NotesPanel events={events} /> : <Sidebar />}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog />
      <ExportImportDialog open={exportImportOpen} onClose={() => setExportImportOpen(false)} />
      <UndoToast />
      <TourOverlay />

      {/* Loading screen — sits on top of everything, fades out once ready */}
      <AnimatePresence>
        {isLoading && <LoadingScreen key="loading" />}
      </AnimatePresence>
    </div>
  );
}
