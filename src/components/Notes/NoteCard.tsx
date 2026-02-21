"use client";

import React from "react";
import { Note } from "@/types";
import { formatYear } from "@/utils/yearUtils";
import { useNotesStore } from "@/stores/notesStore";

interface NoteCardProps {
  note: Note;
}

export function NoteCard({ note }: NoteCardProps) {
  const openDrawer = useNotesStore((s) => s.openDrawer);

  return (
    <button
      onClick={() => openDrawer(note.year, note.id)}
      className="w-full text-left px-3 py-3 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className="text-amber-400/70 text-[10px] font-mono mb-1">{formatYear(note.year)}</div>
      <div className="text-white/90 text-xs font-medium leading-snug truncate">{note.title}</div>
      {note.content && (
        <div className="text-white/40 text-[11px] mt-1 line-clamp-2 leading-relaxed">{note.content}</div>
      )}
    </button>
  );
}
