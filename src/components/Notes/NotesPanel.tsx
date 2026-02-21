"use client";

import React from "react";
import { Plus, StickyNote } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { NoteCard } from "./NoteCard";

export function NotesPanel() {
  const notes      = useNotesStore((s) => s.notes);
  const openDrawer = useNotesStore((s) => s.openDrawer);
  const centerYear = useTimelineStore((s) => s.centerYear);

  return (
    <aside className="w-52 bg-zinc-950 border-r border-white/15 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/15 shrink-0">
        <span className="text-white/50 text-[11px] uppercase tracking-widest font-medium">
          Notes
        </span>
        <button
          onClick={() => openDrawer(centerYear)}
          className="w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="New note"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Notes list or empty state */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 text-center h-full">
            <StickyNote size={22} className="text-white/15" />
            <div className="space-y-1">
              <p className="text-white/30 text-xs">No notes yet</p>
              <p className="text-white/20 text-[10px] leading-relaxed">
                Press + to create your first note
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 p-2">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
