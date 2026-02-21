"use client";

import React from "react";
import { Note } from "@/types";
import { YEAR_START } from "@/utils/constants";
import { useNotesStore } from "@/stores/notesStore";

const DOT_SIZE  = 10; // px  (w-2.5 = 10px)
const DOT_GAP   = 4;  // px between stacked dots
// Tick (16px) + gap (4px) + label font (~12px) + breathing room (8px) = 40px
const STACK_TOP = 40; // px from track top for first dot

interface NoteDotProps {
  note: Note;
  pxPerYear: number;
  stackIndex: number;
}

export function NoteDot({ note, pxPerYear, stackIndex }: NoteDotProps) {
  const openDrawer = useNotesStore((s) => s.openDrawer);
  const left = (note.year - YEAR_START) * pxPerYear + pxPerYear / 2;
  const top  = STACK_TOP + stackIndex * (DOT_SIZE + DOT_GAP);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openDrawer(note.year, note.id);
      }}
      className="absolute -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 hover:bg-amber-300 hover:scale-150 transition-all cursor-pointer z-20 shadow-[0_0_6px_2px_rgba(251,191,36,0.35)]"
      style={{ left, top }}
      title={note.title}
    />
  );
}
