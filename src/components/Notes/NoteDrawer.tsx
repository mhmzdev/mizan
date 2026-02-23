"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { X, Link, Check, ChevronDown, Trash2, Lock } from "lucide-react";
import { getTimelineColor } from "@/utils/timelineColors";
import { motion, AnimatePresence } from "framer-motion";
import { useNotesStore } from "@/stores/notesStore";
import { useDialogStore } from "@/stores/dialogStore";
import { formatYear } from "@/utils/yearUtils";
import { buildNoteUrl } from "@/hooks/useUrlSync";
import { MarkdownEditor } from "./MarkdownEditor";

const MIN_DRAWER_W = 320;
const MAX_DRAWER_W = 700;
const STORAGE_KEY = "mizan_drawer_width";

function parseYearInput(raw: string): number | null {
  const trimmed = raw.trim().toUpperCase();
  let year: number;

  if (trimmed.endsWith("BC")) {
    const num = parseInt(trimmed.replace("BC", "").trim(), 10);
    if (isNaN(num)) return null;
    year = -num;
  } else if (trimmed.endsWith("AD")) {
    const num = parseInt(trimmed.replace("AD", "").trim(), 10);
    if (isNaN(num)) return null;
    year = num - 1;
  } else {
    const num = parseInt(trimmed, 10);
    if (isNaN(num)) return null;
    year = num > 0 ? num - 1 : -num;
  }

  return Math.max(-4000, Math.min(2025, year));
}

const inputClass =
  "w-full bg-no-bg/60 border border-no-border/70 rounded-lg px-3 py-2 text-no-text text-sm placeholder:text-no-muted/50 focus:outline-none focus:border-no-blue/50 transition-colors";

const labelClass = "text-no-muted text-[12px] uppercase tracking-[0.12em] font-medium mb-1";

interface NoteDrawerProps {
  panelWidth: number;
  isMobile?: boolean;
  instantLeft?: boolean; // skip left animation during panel resize
}

export function NoteDrawer({ panelWidth, isMobile, instantLeft }: NoteDrawerProps) {
  const drawerOpen        = useNotesStore((s) => s.drawerOpen);
  const editingNoteId     = useNotesStore((s) => s.editingNoteId);
  const selectedYear      = useNotesStore((s) => s.selectedYear);
  const pendingTitle      = useNotesStore((s) => s.pendingTitle);
  const notes             = useNotesStore((s) => s.notes);
  const timelines         = useNotesStore((s) => s.timelines);
  const lastTimelineId    = useNotesStore((s) => s.lastTimelineId);
  const pendingSourceEvent   = useNotesStore((s) => s.pendingSourceEvent);
  const closeDrawer       = useNotesStore((s) => s.closeDrawer);
  const saveNote          = useNotesStore((s) => s.saveNote);
  const updateNote        = useNotesStore((s) => s.updateNote);
  const deleteNote        = useNotesStore((s) => s.deleteNote);
  const setLastTimelineId    = useNotesStore((s) => s.setLastTimelineId);
  const setDrawerTimelineId  = useNotesStore((s) => s.setDrawerTimelineId);

  const [yearInput,      setYearInput]     = useState("");
  const [yearError,      setYearError]     = useState(false);
  const [title,          setTitle]         = useState("");
  const [content,        setContent]       = useState("");
  const [timelineId,     setTimelineId]    = useState<number>(lastTimelineId);
  const [linkCopied,     setLinkCopied]    = useState(false);
  const [sourceEventId,  setSourceEventId] = useState<string | null>(null);
  const [formKey,        setFormKey]       = useState(0);

  const isEventAnnotation = sourceEventId !== null;

  // Resizable drawer width
  const [drawerWidth, setDrawerWidth] = useState(MIN_DRAWER_W);
  const isResizingRef = useRef(false);

  // Timeline dropdown
  const [timelineDropdownOpen, setTimelineDropdownOpen] = useState(false);
  const timelineDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!timelineDropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (!timelineDropdownRef.current?.contains(e.target as Node)) setTimelineDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [timelineDropdownOpen]);

  // Restore drawer width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setDrawerWidth(Math.max(MIN_DRAWER_W, Math.min(MAX_DRAWER_W, parseInt(saved))));
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    setFormKey((k) => k + 1); // force MarkdownEditor remount with correct content
    let resolvedTimelineId = lastTimelineId;
    if (editingNoteId !== null) {
      const note = notes.find((n) => n.id === editingNoteId);
      if (note) {
        setYearInput(formatYear(note.year));
        setTitle(note.title);
        setContent(note.content);
        resolvedTimelineId = note.timelineId;
        setTimelineId(note.timelineId);
        setSourceEventId(note.sourceEventId ?? null);
      }
    } else {
      setYearInput(formatYear(selectedYear));
      setTitle(pendingTitle);
      setContent("");
      setTimelineId(lastTimelineId);
      setSourceEventId(pendingSourceEvent?.id ?? null);
    }
    setYearError(false);
    setDrawerTimelineId(resolvedTimelineId);
  }, [drawerOpen, editingNoteId, pendingTitle, selectedYear, pendingSourceEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTimelineChange = useCallback((id: number) => {
    setTimelineId(id);
    setLastTimelineId(id);
    setDrawerTimelineId(id);
  }, [setLastTimelineId, setDrawerTimelineId]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    const parsedYear = parseYearInput(yearInput);
    if (parsedYear === null) { setYearError(true); return; }

    if (editingNoteId !== null) {
      await updateNote(editingNoteId, { timelineId, year: parsedYear, title: title.trim(), content });
    } else {
      await saveNote({
        timelineId,
        year: parsedYear,
        title: title.trim(),
        content,
        ...(sourceEventId ? { sourceEventId } : {}),
      });
    }
    closeDrawer();
  }, [yearInput, title, content, timelineId, editingNoteId, sourceEventId, saveNote, updateNote, closeDrawer]);

  const handleCopyNoteLink = useCallback(() => {
    if (editingNoteId === null) return;
    const note = notes.find((n) => n.id === editingNoteId);
    if (!note) return;
    navigator.clipboard.writeText(buildNoteUrl(editingNoteId, note.year)).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [editingNoteId, notes]);

  const handleDelete = useCallback(async () => {
    if (editingNoteId === null) return;
    const ok = await useDialogStore.getState().confirm({
      title: "Delete note?",
      message: "This note will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    await deleteNote(editingNoteId);
    closeDrawer();
  }, [editingNoteId, deleteNote, closeDrawer]);

  function startResizeDrawer(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const startX = e.clientX;
    const startW = drawerWidth;
    function onMove(ev: MouseEvent) {
      setDrawerWidth(Math.max(MIN_DRAWER_W, Math.min(MAX_DRAWER_W, startW + ev.clientX - startX)));
    }
    function onUp(ev: MouseEvent) {
      const w = Math.max(MIN_DRAWER_W, Math.min(MAX_DRAWER_W, startW + ev.clientX - startX));
      setDrawerWidth(w);
      localStorage.setItem(STORAGE_KEY, String(w));
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // Shared inner content — reused by both mobile and desktop variants
  const drawerBody = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-no-border shrink-0">
        <span className="text-no-text/50 text-[12px] uppercase tracking-[0.15em] font-semibold flex-1">
          {editingNoteId !== null ? "Edit Note" : "New Note"}
        </span>

        {editingNoteId !== null && (
          <button
            onClick={handleCopyNoteLink}
            title="Copy note link"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
          >
            {linkCopied
              ? <Check size={12} className="text-green-400" />
              : <Link size={12} />
            }
          </button>
        )}

        <button
          onClick={closeDrawer}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-no-muted hover:text-no-text hover:bg-no-card transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col overflow-y-auto panel-scroll min-h-0">

        {/* ── Metadata: Timeline + Year ── */}
        <div className="flex flex-col gap-2.5 px-4 pt-4 pb-4 border-b border-no-border/50">
          {/* Custom Timeline dropdown */}
          {(() => {
            const idx   = timelines.findIndex((t) => t.id === timelineId);
            const color = idx >= 0 ? getTimelineColor(idx) : "var(--color-no-muted)";
            const name  = idx >= 0 ? timelines[idx].title : "Select timeline";
            return (
              <div ref={timelineDropdownRef} className="relative">
                <button
                  onClick={() => setTimelineDropdownOpen((v) => !v)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-no-card border border-no-border text-[12px] transition-colors hover:border-no-blue/30"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="flex-1 text-left truncate text-no-text">{name}</span>
                  <ChevronDown
                    size={11}
                    className={`text-no-muted/60 shrink-0 transition-transform duration-150 ${timelineDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {timelineDropdownOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-no-panel border border-no-border rounded-xl shadow-xl z-50 overflow-hidden">
                    {timelines.map((tl, i) => {
                      const c    = getTimelineColor(i);
                      const isSel = tl.id === timelineId;
                      return (
                        <button
                          key={tl.id}
                          onClick={() => { handleTimelineChange(tl.id!); setTimelineDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors ${isSel ? "bg-no-card" : "hover:bg-no-card/60"}`}
                          style={{ color: isSel ? c : undefined }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                          <span className="flex-1 text-left truncate">{tl.title}</span>
                          {isSel && <Check size={10} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Year */}
          <div>
            {isEventAnnotation ? (
              <div className="w-full flex items-center gap-2 px-3 py-2 bg-no-bg/40 border border-no-border/40 rounded-lg">
                <Lock size={10} className="text-no-muted/40 shrink-0" />
                <span className="text-no-text/60 text-sm font-mono">{yearInput}</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={yearInput}
                  onChange={(e) => { setYearInput(e.target.value); setYearError(false); }}
                  placeholder="e.g. 500 BC or 1066 AD"
                  className={`${inputClass} font-mono ${yearError ? "border-red-500/60 focus:border-red-500" : ""}`}
                />
                {yearError && (
                  <p className="text-red-400 text-[12px] mt-1">Enter a valid year — e.g. &quot;500 BC&quot; or &quot;1066 AD&quot;</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Content: Title + Notes — one continuous unit ── */}
        <div className="flex flex-col px-4 pt-5 pb-4">
          {isEventAnnotation ? (
            <>
              {/* Locked title — shows the historical event name */}
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-no-text text-[1.4rem] font-semibold leading-snug">{title}</p>
                </div>
                <div className="flex items-center gap-1 mt-1.5 shrink-0 bg-no-card border border-no-border/60 rounded px-1.5 py-0.5">
                  <Lock size={9} className="text-no-muted/50" />
                  <span className="text-no-muted/50 text-[9px] uppercase tracking-[0.1em] font-medium">Historical</span>
                </div>
              </div>
            </>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-transparent text-no-text text-[1.4rem] font-semibold placeholder:text-no-muted/35 outline-none mb-4 leading-snug"
            />
          )}
          <div className="flex items-center gap-1 mb-2">
            <span className="text-no-muted/35 text-[11px] uppercase tracking-[0.12em]">
              {isEventAnnotation ? "Your notes" : "Markdown supported"}
            </span>
          </div>
          <MarkdownEditor key={formKey} value={content} onChange={setContent} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-4 border-t border-no-border shrink-0">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="flex-1 bg-no-blue hover:bg-no-blue-dim disabled:opacity-40 disabled:cursor-not-allowed text-no-blue-fg text-sm font-semibold rounded-lg px-3 py-2.5 transition-colors"
        >
          Save
        </button>
        {editingNoteId !== null && (
          <button
            onClick={handleDelete}
            title="Delete note"
            className="w-10 h-10 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20 shrink-0"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {drawerOpen && (
        isMobile ? (
          /* ── Mobile: full-screen overlay, slides up from bottom ── */
          <motion.div
            key="mobile-drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 bg-no-bg flex flex-col z-[70]"
            onClick={(e) => e.stopPropagation()}
          >
            {drawerBody}
          </motion.div>
        ) : (
          /* ── Desktop: slides in from the left, beside the notes panel ── */
          <>
            <motion.div
              key="desktop-drawer"
              initial={{ x: -12, opacity: 0, left: panelWidth }}
              animate={{ x: 0,   opacity: 1, left: panelWidth }}
              exit={{   x: -12, opacity: 0 }}
              transition={{
                x:       { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                left:    instantLeft ? { duration: 0 } : { type: "tween", duration: 0.22, ease: [0.4, 0, 0.2, 1] },
              }}
              className="absolute top-0 bottom-0 bg-no-bg/80 backdrop-blur-md border-r border-no-border/60 flex flex-col z-[55] supports-[backdrop-filter]:bg-no-bg/75"
              style={{ width: drawerWidth, boxShadow: "var(--drawer-shadow)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {drawerBody}

              {/* Resize handle — right edge */}
              <div
                className="absolute top-0 bottom-0 right-[-5px] w-[10px] z-[56] cursor-col-resize select-none group"
                onMouseDown={startResizeDrawer}
              >
                <div className="absolute inset-y-0 left-[4px] w-px bg-no-blue/0 group-hover:bg-no-blue/50 transition-colors duration-150" />
              </div>
            </motion.div>
          </>
        )
      )}
    </AnimatePresence>
  );
}
