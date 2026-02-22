"use client";

import React, { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
import { useDialogStore } from "@/stores/dialogStore";
import { formatYear } from "@/utils/yearUtils";
import { YEAR_START } from "@/utils/constants";

const MAX_TIMELINES = 5;

export function Sidebar() {
  const centerYear = useTimelineStore((s) => s.centerYear);

  const timelines      = useNotesStore((s) => s.timelines);
  const addTimeline    = useNotesStore((s) => s.addTimeline);
  const deleteTimeline = useNotesStore((s) => s.deleteTimeline);

  const [jumpInput,   setJumpInput]   = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle,    setNewTitle]    = useState("");

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

  const handleDeleteTimeline = useCallback(async (id: number, title: string) => {
    const ok = await useDialogStore.getState().confirm({
      title: `Delete "${title}"?`,
      message: "All notes in this timeline will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) deleteTimeline(id);
  }, [deleteTimeline]);

  const canAdd = timelines.length < MAX_TIMELINES;

  return (
    <aside className="w-52 bg-no-panel border-l border-no-border flex flex-col p-4 gap-5 shrink-0 overflow-y-auto">
      {/* Center year */}
      <div className="text-center">
        <div className="text-no-muted text-[10px] uppercase tracking-[0.15em] mb-1.5 font-medium">
          Center
        </div>
        <div className="text-no-text text-2xl font-mono font-semibold tracking-tight">
          {formatYear(centerYear)}
        </div>
      </div>

      <div className="h-px bg-no-border" />

      {/* Jump to year */}
      <div>
        <div className="text-no-muted text-[10px] uppercase tracking-[0.15em] mb-2.5 font-medium">
          Jump to Year
        </div>
        <form onSubmit={handleJump} className="flex flex-col gap-2">
          <input
            type="text"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder="e.g. 500 BC"
            className="w-full bg-no-card border border-no-border rounded-lg px-3 py-2 text-no-text text-sm placeholder:text-no-muted/60 focus:outline-none focus:border-no-blue/50 transition-colors"
          />
          <button
            type="submit"
            className="w-full bg-no-blue/10 hover:bg-no-blue/20 text-no-blue text-sm font-semibold rounded-lg px-3 py-2 transition-colors border border-no-blue/20 hover:border-no-blue/40"
          >
            Go
          </button>
        </form>
      </div>

      <div className="h-px bg-no-border" />

      {/* Timelines */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-no-muted text-[10px] uppercase tracking-[0.15em] font-medium">
            Timelines
          </span>
          {canAdd && (
            <button
              onClick={() => { setShowAddForm((v) => !v); setNewTitle(""); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
              title="Add timeline"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {timelines.map((tl) => (
            <div
              key={tl.id}
              className="flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg bg-no-card border border-no-border group"
            >
              <span className="text-no-text/70 text-xs truncate leading-snug">{tl.title}</span>
              {!tl.isDefault && (
                <button
                  onClick={() => handleDeleteTimeline(tl.id!, tl.title)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-no-muted/40 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove timeline"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        {showAddForm && (
          <form onSubmit={handleAddTimeline} className="flex flex-col gap-1.5 mt-1">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Timeline title"
              autoFocus
              maxLength={40}
              className="w-full bg-no-card border border-no-border rounded-lg px-2.5 py-1.5 text-no-text text-xs placeholder:text-no-muted/60 focus:outline-none focus:border-no-blue/50 transition-colors"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="flex-1 bg-no-blue/10 hover:bg-no-blue/20 disabled:opacity-40 text-no-blue text-xs font-semibold rounded-lg py-1.5 transition-colors border border-no-blue/20"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewTitle(""); }}
                className="flex-1 text-no-muted hover:text-no-text text-xs rounded-lg py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
            {timelines.length >= MAX_TIMELINES - 1 && (
              <p className="text-no-muted/60 text-[10px]">{MAX_TIMELINES - timelines.length} slot remaining</p>
            )}
          </form>
        )}

        {!canAdd && !showAddForm && (
          <p className="text-no-muted/50 text-[10px]">Max {MAX_TIMELINES} timelines reached</p>
        )}
      </div>

      {/* Shortcuts */}
      <div className="mt-auto">
        <div className="text-no-muted/75 text-[10px] space-y-1 font-mono">
          <p>Scroll — Zoom</p>
          <p>Shift+Scroll — Pan</p>
        </div>
      </div>
    </aside>
  );
}
