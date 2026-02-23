"use client";

import React from "react";
import { Note } from "@/types";
import { useFormatYear } from "@/hooks/useFormatYear";
import { useNotesStore } from "@/stores/notesStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { MAX_PX_PER_YEAR, YEAR_START } from "@/utils/constants";
import { getTimelineColor, alphaColor } from "@/utils/timelineColors";

interface NoteCardProps {
  note: Note;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}

export function NoteCard({ note }: NoteCardProps) {
  const openDrawer   = useNotesStore((s) => s.openDrawer);
  const timelines    = useNotesStore((s) => s.timelines);
  const fmt          = useFormatYear();
  const timelineIndex = timelines.findIndex((t) => t.id === note.timelineId);
  const timelineName  = timelineIndex >= 0 ? timelines[timelineIndex].title : "";
  const timelineColor = timelineIndex >= 0 ? getTimelineColor(timelineIndex) : "#6C7380";

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
      className="relative w-full text-left px-3 py-3 rounded-xl bg-no-card hover:bg-no-border border border-no-border transition-all group overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: timelineColor }} />
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-no-gold/80 text-[12px] font-mono">{fmt(note.year)}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {note.linkedNoteId && (
            <span className="text-[9px] text-no-blue/70 font-mono" title="Linked note">↔</span>
          )}
          {timelineName && (
            <span
              className="text-[9px] uppercase tracking-wide truncate max-w-[80px] font-medium"
              style={{ color: alphaColor(timelineColor, 70) }}
            >
              {timelineName}
            </span>
          )}
        </div>
      </div>
      <div className="text-no-text/90 text-xs font-medium leading-snug truncate">{note.title}</div>
      {note.content && (
        <div className="text-no-muted/80 text-[13px] mt-1 line-clamp-2 leading-relaxed">{stripHtml(note.content)}</div>
      )}
    </button>
  );
}
