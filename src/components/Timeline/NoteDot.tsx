"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Note } from "@/types";
import { YEAR_START } from "@/utils/constants";
import { formatYear } from "@/utils/yearUtils";
import { useNotesStore } from "@/stores/notesStore";
import { ACTIVE_DOT_COLOR, alphaColor } from "@/utils/timelineColors";

const DOT_GAP   = 4;
const STACK_TOP = 40;

function getDotPx(pxPerYear: number): number {
  if (pxPerYear >= 100) return 10;
  if (pxPerYear >= 15)  return 6;
  return 4;
}

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

  const [hovered, setHovered] = useState(false);

  const isActive = drawerOpen && note.id === editingNoteId;

  const dotPx    = getDotPx(pxPerYear);
  const activePx = dotPx + 4;

  const left = (note.year - YEAR_START) * pxPerYear + pxPerYear / 2;
  const top  = STACK_TOP + stackIndex * (dotPx + DOT_GAP);

  const dotColor      = isActive ? ACTIVE_DOT_COLOR : color;
  const inactiveGlow  = `0 0 8px 2px ${alphaColor(color, 30)}`;
  const inactiveHover = `0 0 12px 3px ${alphaColor(color, 45)}`;

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
        className={`relative block rounded-full cursor-pointer transition-[width,height,transform] duration-200 ${isActive ? "dot-pulse" : "hover:scale-150"}`}
        style={{
          width:  isActive ? activePx : dotPx,
          height: isActive ? activePx : dotPx,
          backgroundColor: dotColor,
          boxShadow: isActive ? undefined : inactiveGlow,
        }}
        onMouseEnter={(e) => {
          setHovered(true);
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.boxShadow = inactiveHover;
        }}
        onMouseLeave={(e) => {
          setHovered(false);
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.boxShadow = inactiveGlow;
        }}
      />

      {/* Hover tooltip — shown below the dot when not active */}
      {hovered && !isActive && (
        <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <div className="bg-no-panel border border-no-border/80 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
            <p className="text-no-text text-[12px] font-medium leading-snug">
              {note.title || "Untitled"}
            </p>
            <p className="text-no-muted text-[10px] font-mono mt-0.5">
              {formatYear(note.year)}
            </p>
          </div>
        </div>
      )}

      {/* Active card — shown below when the drawer is open for this note */}
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
