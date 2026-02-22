"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Note } from "@/types";
import { YEAR_START } from "@/utils/constants";
import { formatYear } from "@/utils/yearUtils";
import { useNotesStore } from "@/stores/notesStore";
import { ACTIVE_DOT_COLOR } from "@/utils/timelineColors";

const DOT_SIZE  = 10;
const DOT_GAP   = 4;
const STACK_TOP = 40;

interface NoteDotProps {
  note: Note;
  pxPerYear: number;
  stackIndex: number;
  color: string;
}

export function NoteDot({ note, pxPerYear, stackIndex, color }: NoteDotProps) {
  const openDrawer    = useNotesStore((s) => s.openDrawer);
  const editingNoteId = useNotesStore((s) => s.editingNoteId);
  const drawerOpen    = useNotesStore((s) => s.drawerOpen);

  const isActive = drawerOpen && note.id === editingNoteId;

  const left = (note.year - YEAR_START) * pxPerYear + pxPerYear / 2;
  const top  = STACK_TOP + stackIndex * (DOT_SIZE + DOT_GAP);

  const dotColor      = isActive ? ACTIVE_DOT_COLOR : color;
  // 30% opacity glow using the timeline's own color
  const inactiveGlow  = `0 0 8px 2px ${color}4D`;
  const inactiveHover = `0 0 12px 3px ${color}73`;

  return (
    <div
      className={`absolute -translate-x-1/2 ${isActive ? "z-40" : "z-20"}`}
      style={{ left, top }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          openDrawer(note.year, note.id);
        }}
        title={note.title}
        className={`relative block rounded-full cursor-pointer transition-[width,height] duration-200 ${
          isActive
            ? "w-3.5 h-3.5 dot-pulse"
            : "w-2.5 h-2.5 hover:scale-150"
        }`}
        style={{
          backgroundColor: dotColor,
          boxShadow: isActive ? undefined : inactiveGlow,
          // Apply hover glow via CSS custom property trick isn't possible inline,
          // so we rely on the static glow; hover scale is enough visual feedback.
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.boxShadow = inactiveHover;
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.boxShadow = inactiveGlow;
        }}
      />

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.88 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -6, scale: 0.88 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute top-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="bg-no-card/95 border border-no-border/70 rounded-xl px-3 py-2 shadow-xl text-center whitespace-nowrap backdrop-blur-sm">
              <p className="text-no-text text-[13px] font-semibold leading-snug max-w-[160px] truncate">
                {note.title || "Untitled"}
              </p>
              <p className="text-no-muted text-[12px] font-mono leading-snug mt-0.5">
                {formatYear(note.year)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
