"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { formatYear } from "@/utils/yearUtils";

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

export function NoteDrawer() {
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
  const setLastTimelineId = useNotesStore((s) => s.setLastTimelineId);

  const [yearInput,   setYearInput]   = useState("");
  const [yearError,   setYearError]   = useState(false);
  const [title,       setTitle]       = useState("");
  const [content,     setContent]     = useState("");
  const [timelineId,  setTimelineId]  = useState<number>(lastTimelineId);

  // Populate form on open
  useEffect(() => {
    if (!drawerOpen) return;
    if (editingNoteId !== null) {
      const note = notes.find((n) => n.id === editingNoteId);
      if (note) {
        setYearInput(formatYear(note.year));
        setTitle(note.title);
        setContent(note.content);
        setTimelineId(note.timelineId);
      }
    } else {
      setYearInput(formatYear(selectedYear));
      setTitle("");
      setContent("");
      setTimelineId(lastTimelineId);
    }
    setYearError(false);
  }, [drawerOpen, editingNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTimelineChange = useCallback((id: number) => {
    setTimelineId(id);
    setLastTimelineId(id);
  }, [setLastTimelineId]);

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

  const handleDelete = useCallback(async () => {
    if (editingNoteId === null) return;
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    await deleteNote(editingNoteId);
    closeDrawer();
  }, [editingNoteId, deleteNote, closeDrawer]);

  if (!drawerOpen) return null;

  return (
    <div
      className="absolute top-0 bottom-0 left-52 w-80 bg-zinc-900 border-r border-white/15 flex flex-col z-40 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/15 shrink-0">
        <span className="text-white/50 text-[11px] uppercase tracking-widest font-medium">
          {editingNoteId !== null ? "Edit Note" : "New Note"}
        </span>
        <button
          onClick={closeDrawer}
          className="w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">

        {/* Timeline selector */}
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-[10px] uppercase tracking-widest">Timeline</label>
          <select
            value={timelineId}
            onChange={(e) => handleTimelineChange(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-white/90 text-sm focus:outline-none focus:border-white/40 appearance-none cursor-pointer"
          >
            {timelines.map((tl) => (
              <option key={tl.id} value={tl.id} className="bg-zinc-900 text-white">
                {tl.title}
              </option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-[10px] uppercase tracking-widest">Year</label>
          <input
            type="text"
            value={yearInput}
            onChange={(e) => { setYearInput(e.target.value); setYearError(false); }}
            placeholder="e.g. 500 BC or 1066 AD"
            className={`w-full bg-white/5 border rounded-md px-3 py-2 text-white/90 text-sm font-mono placeholder:text-white/25 focus:outline-none transition-colors ${
              yearError ? "border-red-500/60 focus:border-red-500" : "border-white/15 focus:border-white/40"
            }`}
          />
          {yearError && (
            <p className="text-red-400 text-[10px]">Enter a valid year, e.g. "500 BC" or "1066 AD"</p>
          )}
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/40"
        />

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Notes…"
          rows={7}
          className="flex-1 w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/40 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-4 border-t border-white/15 shrink-0">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="flex-1 bg-white text-black text-sm font-medium rounded-md px-3 py-2 transition-colors hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        {editingNoteId !== null && (
          <button
            onClick={handleDelete}
            className="bg-red-500/20 hover:bg-red-500/40 text-red-400 text-sm font-medium rounded-md px-3 py-2 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
