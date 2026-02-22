"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, Link, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotesStore } from "@/stores/notesStore";
import { useDialogStore } from "@/stores/dialogStore";
import { formatYear } from "@/utils/yearUtils";
import { buildNoteUrl } from "@/hooks/useUrlSync";

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
  "w-full bg-[#1A1C1E]/60 border border-no-border/70 rounded-lg px-3 py-2 text-no-text text-sm placeholder:text-no-muted/50 focus:outline-none focus:border-no-blue/50 transition-colors";

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
  const notes             = useNotesStore((s) => s.notes);
  const timelines         = useNotesStore((s) => s.timelines);
  const lastTimelineId    = useNotesStore((s) => s.lastTimelineId);
  const closeDrawer       = useNotesStore((s) => s.closeDrawer);
  const saveNote          = useNotesStore((s) => s.saveNote);
  const updateNote        = useNotesStore((s) => s.updateNote);
  const deleteNote        = useNotesStore((s) => s.deleteNote);
  const setLastTimelineId    = useNotesStore((s) => s.setLastTimelineId);
  const setDrawerTimelineId  = useNotesStore((s) => s.setDrawerTimelineId);

  const [yearInput,   setYearInput]  = useState("");
  const [yearError,   setYearError]  = useState(false);
  const [title,       setTitle]      = useState("");
  const [content,     setContent]    = useState("");
  const [timelineId,  setTimelineId] = useState<number>(lastTimelineId);
  const [linkCopied,  setLinkCopied] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    let resolvedTimelineId = lastTimelineId;
    if (editingNoteId !== null) {
      const note = notes.find((n) => n.id === editingNoteId);
      if (note) {
        setYearInput(formatYear(note.year));
        setTitle(note.title);
        setContent(note.content);
        resolvedTimelineId = note.timelineId;
        setTimelineId(note.timelineId);
      }
    } else {
      setYearInput(formatYear(selectedYear));
      setTitle("");
      setContent("");
      setTimelineId(lastTimelineId);
    }
    setYearError(false);
    setDrawerTimelineId(resolvedTimelineId);
  }, [drawerOpen, editingNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await saveNote({ timelineId, year: parsedYear, title: title.trim(), content });
    }
    closeDrawer();
  }, [yearInput, title, content, timelineId, editingNoteId, saveNote, updateNote, closeDrawer]);

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
      <div className="flex-1 flex flex-col gap-3.5 p-4 overflow-y-auto">
        <div className="flex flex-col">
          <label className={labelClass}>Timeline</label>
          <select
            value={timelineId}
            onChange={(e) => handleTimelineChange(Number(e.target.value))}
            className={`${inputClass} appearance-none cursor-pointer`}
          >
            {timelines.map((tl) => (
              <option key={tl.id} value={tl.id} className="bg-[#1F2226] text-[#E1E2E5]">
                {tl.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className={labelClass}>Year</label>
          <input
            type="text"
            value={yearInput}
            onChange={(e) => { setYearInput(e.target.value); setYearError(false); }}
            placeholder="e.g. 500 BC or 1066 AD"
            className={`${inputClass} font-mono ${yearError ? "border-red-500/60 focus:border-red-500" : ""}`}
          />
          {yearError && (
            <p className="text-red-400 text-[12px] mt-1">Enter a valid year — e.g. "500 BC" or "1066 AD"</p>
          )}
        </div>

        <div className="flex flex-col">
          <label className={labelClass}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col flex-1">
          <label className={labelClass}>Notes</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your notes…"
            rows={7}
            className={`${inputClass} resize-none flex-1`}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-4 border-t border-no-border shrink-0">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="flex-1 bg-no-blue hover:bg-[#5B8FFF] disabled:opacity-40 disabled:cursor-not-allowed text-[#1A1C1E] text-sm font-semibold rounded-lg px-3 py-2.5 transition-colors"
        >
          Save
        </button>
        {editingNoteId !== null && (
          <button
            onClick={handleDelete}
            className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20"
          >
            Delete
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
            className="fixed inset-0 bg-[#1A1C1E] flex flex-col z-[70]"
            onClick={(e) => e.stopPropagation()}
          >
            {drawerBody}
          </motion.div>
        ) : (
          /* ── Desktop: slides in from the left, beside the notes panel ── */
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
            className="absolute top-0 bottom-0 w-80 bg-[#1A1C1E]/80 backdrop-blur-md border-r border-no-border/60 flex flex-col z-[55] shadow-[4px_0_40px_rgba(0,0,0,0.6)] supports-[backdrop-filter]:bg-[#1A1C1E]/75"
            onClick={(e) => e.stopPropagation()}
          >
            {drawerBody}
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}
