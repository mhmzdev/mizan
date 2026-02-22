"use client";

import React from "react";
import { Note } from "@/types";
import { formatYear } from "@/utils/yearUtils";
import { useNotesStore } from "@/stores/notesStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { MAX_PX_PER_YEAR, YEAR_START } from "@/utils/constants";

interface NoteCardProps {
  note: Note;
}

export function NoteCard({ note }: NoteCardProps) {
  const openDrawer  = useNotesStore((s) => s.openDrawer);
  const timelines   = useNotesStore((s) => s.timelines);
  const timelineName = timelines.find((t) => t.id === note.timelineId)?.title ?? "";

  function handleClick() {
    openDrawer(note.year, note.id);

    const { viewportWidth, setTargetPxPerYear } = useTimelineStore.getState();
    const newScrollLeft = Math.max(0, (note.year - YEAR_START) * MAX_PX_PER_YEAR - viewportWidth / 2);
    useTimelineStore.setState({ centerYear: note.year, scrollLeft: newScrollLeft });
    setTargetPxPerYear(MAX_PX_PER_YEAR);
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-3 py-3 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-amber-400/70 text-[10px] font-mono">{formatYear(note.year)}</span>
        {timelineName && (
          <span className="text-white/25 text-[9px] uppercase tracking-wide truncate max-w-[80px]">{timelineName}</span>
        )}
      </div>
      <div className="text-white/90 text-xs font-medium leading-snug truncate">{note.title}</div>
      {note.content && (
        <div className="text-white/40 text-[11px] mt-1 line-clamp-2 leading-relaxed">{note.content}</div>
      )}
    </button>
  );
}
