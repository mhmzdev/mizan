"use client";

import React, { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
import { formatYear } from "@/utils/yearUtils";
import { YEAR_START } from "@/utils/constants";

const MAX_TIMELINES = 5;

export function Sidebar() {
  const centerYear = useTimelineStore((s) => s.centerYear);

  const timelines       = useNotesStore((s) => s.timelines);
  const addTimeline     = useNotesStore((s) => s.addTimeline);
  const deleteTimeline  = useNotesStore((s) => s.deleteTimeline);

  const [jumpInput,    setJumpInput]    = useState("");
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [newTitle,     setNewTitle]     = useState("");

  const handleJump = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = jumpInput.trim().toUpperCase();
      let year: number;

      if (trimmed.endsWith("BC")) {
        const num = parseInt(trimmed.replace("BC", "").trim());
        if (isNaN(num)) return;
        year = -num;
      } else if (trimmed.endsWith("AD")) {
        const num = parseInt(trimmed.replace("AD", "").trim());
        if (isNaN(num)) return;
        year = num - 1;
      } else {
        const num = parseInt(trimmed);
        if (isNaN(num)) return;
        year = num > 0 ? num - 1 : -num;
      }

      year = Math.max(-4000, Math.min(2025, year));

      const { pxPerYear: px, viewportWidth } = useTimelineStore.getState();
      const newScrollLeft = Math.max(0, (year - YEAR_START) * px - viewportWidth / 2);
      useTimelineStore.setState({ scrollLeft: newScrollLeft, centerYear: year });

      const container = document.querySelector(".timeline-scroll");
      if (container) container.scrollLeft = newScrollLeft;

      setJumpInput("");
    },
    [jumpInput]
  );

  const handleAddTimeline = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTitle.trim()) return;
      await addTimeline(newTitle.trim());
      setNewTitle("");
      setShowAddForm(false);
    },
    [newTitle, addTimeline]
  );

  const canAdd = timelines.length < MAX_TIMELINES;

  return (
    <aside className="w-52 bg-zinc-950 border-l border-white/15 flex flex-col p-4 gap-5 shrink-0 overflow-y-auto">
      {/* Center year display */}
      <div className="text-center">
        <div className="text-white/50 text-[11px] uppercase tracking-widest mb-1">Center</div>
        <div className="text-white text-2xl font-mono font-semibold">{formatYear(centerYear)}</div>
      </div>

      <div className="h-px bg-white/15" />

      {/* Jump to year */}
      <div>
        <div className="text-white/50 text-[11px] uppercase tracking-widest mb-2.5">Jump to Year</div>
        <form onSubmit={handleJump} className="flex flex-col gap-2">
          <input
            type="text"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder="e.g. 500 BC"
            className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-md px-3 py-2 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      <div className="h-px bg-white/15" />

      {/* Timelines */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-white/50 text-[11px] uppercase tracking-widest">Timelines</span>
          {canAdd && (
            <button
              onClick={() => { setShowAddForm((v) => !v); setNewTitle(""); }}
              className="w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              title="Add timeline"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {/* Timeline list */}
        <div className="flex flex-col gap-1">
          {timelines.map((tl) => (
            <div
              key={tl.id}
              className="flex items-center justify-between gap-1 px-2 py-1.5 rounded bg-white/5 group"
            >
              <span className="text-white/70 text-xs truncate leading-snug">{tl.title}</span>
              {!tl.isDefault && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${tl.title}"?\n\nAll notes in this timeline will be permanently deleted.`)) {
                      deleteTimeline(tl.id!);
                    }
                  }}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove timeline"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <form onSubmit={handleAddTimeline} className="flex flex-col gap-1.5 mt-1">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Timeline title"
              autoFocus
              maxLength={40}
              className="w-full bg-white/5 border border-white/15 rounded-md px-2.5 py-1.5 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-white/40"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="flex-1 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-medium rounded-md py-1.5 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewTitle(""); }}
                className="flex-1 text-white/40 hover:text-white text-xs rounded-md py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
            {timelines.length >= MAX_TIMELINES - 1 && (
              <p className="text-white/30 text-[10px]">{MAX_TIMELINES - timelines.length} slot remaining</p>
            )}
          </form>
        )}

        {!canAdd && !showAddForm && (
          <p className="text-white/25 text-[10px]">Max {MAX_TIMELINES} timelines reached</p>
        )}
      </div>

      {/* Shortcuts */}
      <div className="mt-auto">
        <div className="text-white/30 text-[11px] space-y-1">
          <p>Scroll: Zoom</p>
          <p>Shift + Scroll: Pan</p>
        </div>
      </div>
    </aside>
  );
}
