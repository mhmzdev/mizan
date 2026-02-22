"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2 } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";

const DURATION_MS = 5000;

export function UndoToast() {
  const pendingDelete = useNotesStore((s) => s.pendingDelete);
  const undoDelete    = useNotesStore((s) => s.undoDelete);
  const commitDelete  = useNotesStore((s) => s.commitDelete);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restart the 5-second commit timer whenever a new deletion comes in
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!pendingDelete) return;
    timerRef.current = setTimeout(() => commitDelete(), DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingDelete, commitDelete]);

  // Build the label
  const label = pendingDelete
    ? pendingDelete.type === "note"
      ? `"${pendingDelete.note.title}" deleted`
      : `"${pendingDelete.timeline.title}" and its notes deleted`
    : "";

  // Use the deleted item's identity as key so AnimatePresence replaces the toast
  // when a different item is deleted
  const toastKey = pendingDelete
    ? `${pendingDelete.type}-${
        pendingDelete.type === "note"
          ? pendingDelete.note.id
          : pendingDelete.timeline.id
      }`
    : "none";

  return (
    <AnimatePresence>
      {pendingDelete && (
        <motion.div
          key={toastKey}
          initial={{ y: 16, opacity: 0, scale: 0.97 }}
          animate={{ y: 0,  opacity: 1, scale: 1    }}
          exit={{   y: 16, opacity: 0, scale: 0.97 }}
          transition={{ type: "tween", duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[65] min-w-[260px] max-w-[420px] rounded-xl overflow-hidden bg-no-panel border border-no-border shadow-2xl"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}
        >
          {/* Progress bar — shrinks to 0 over DURATION_MS */}
          <div className="h-[2px] bg-no-border/60">
            <div
              key={toastKey}
              className="h-full bg-no-blue origin-left"
              style={{ animation: `undo-progress ${DURATION_MS}ms linear forwards` }}
            />
          </div>

          {/* Content row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 text-no-text/90 text-sm truncate min-w-0">
              {label}
            </span>
            <button
              onClick={() => undoDelete()}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-no-blue/15 hover:bg-no-blue/25 text-no-blue text-xs font-semibold transition-colors border border-no-blue/20 hover:border-no-blue/40"
            >
              <Undo2 size={12} />
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
