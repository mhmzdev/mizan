"use client";

import React, { useState, useCallback, useRef } from "react";
import { Plus, X, Pencil, Check, Eye, EyeOff } from "lucide-react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useNotesStore } from "@/stores/notesStore";
import { useDialogStore } from "@/stores/dialogStore";
import { formatYear } from "@/utils/yearUtils";
import { YEAR_START, YEAR_END, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR } from "@/utils/constants";

function parseYear(raw: string): number | null {
  const t = raw.trim().toUpperCase();
  let year: number;
  if (t.endsWith("BC")) {
    const n = parseInt(t.replace("BC", "").trim());
    if (isNaN(n)) return null;
    year = -n;
  } else if (t.endsWith("AD")) {
    const n = parseInt(t.replace("AD", "").trim());
    if (isNaN(n)) return null;
    year = n - 1;
  } else {
    const n = parseInt(t);
    if (isNaN(n)) return null;
    year = n > 0 ? n - 1 : -n;
  }
  return Math.max(YEAR_START, Math.min(YEAR_END, year));
}

const MAX_TIMELINES = 5;

export function Sidebar() {
  const centerYear = useTimelineStore((s) => s.centerYear);
  const rangeStart = useTimelineStore((s) => s.rangeStart);
  const rangeEnd   = useTimelineStore((s) => s.rangeEnd);
  const setRange      = useTimelineStore((s) => s.setRange);
  const clearRange    = useTimelineStore((s) => s.clearRange);
  const setPendingNav = useTimelineStore((s) => s.setPendingNav);
  const rangeActive = rangeStart !== null && rangeEnd !== null;

  const timelines             = useNotesStore((s) => s.timelines);
  const addTimeline           = useNotesStore((s) => s.addTimeline);
  const renameTimeline        = useNotesStore((s) => s.renameTimeline);
  const deleteTimeline        = useNotesStore((s) => s.deleteTimeline);
  const toggleTimelineHidden  = useNotesStore((s) => s.toggleTimelineHidden);
  const closeDrawer           = useNotesStore((s) => s.closeDrawer);

  const [jumpInput,          setJumpInput]          = useState("");
  const [fromInput,          setFromInput]          = useState("");
  const [toInput,            setToInput]            = useState("");
  const [fromError,          setFromError]          = useState(false);
  const [toError,            setToError]            = useState(false);
  const [showAddForm,        setShowAddForm]        = useState(false);
  const [newTitle,           setNewTitle]           = useState("");
  const [editingTimelineId,  setEditingTimelineId]  = useState<number | null>(null);
  const [editTitle,          setEditTitle]          = useState("");
  const cancelEditRef = useRef(false);

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
      closeDrawer();
    },
    [jumpInput, closeDrawer]
  );

  const handleApplyRange = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const start = parseYear(fromInput);
      const end   = parseYear(toInput);
      let valid = true;
      if (start === null) { setFromError(true); valid = false; }
      if (end   === null) { setToError(true);   valid = false; }
      if (!valid) return;
      // Auto-sort so "from" is always the earlier year.
      const [s, f] = start! <= end! ? [start!, end!] : [end!, start!];
      setRange(s, f);
      // Navigate to fit the range in view.
      const { viewportWidth } = useTimelineStore.getState();
      const midYear   = Math.round((s + f) / 2);
      const rangeYears = f - s + 1;
      const fittingZoom = Math.max(
        MIN_PX_PER_YEAR,
        Math.min(MAX_PX_PER_YEAR, (viewportWidth * 0.75) / rangeYears),
      );
      setPendingNav({ year: midYear, zoom: fittingZoom });
    },
    [fromInput, toInput, setRange, setPendingNav]
  );

  const handleClearRange = useCallback(() => {
    clearRange();
    setFromInput("");
    setToInput("");
    setFromError(false);
    setToError(false);
  }, [clearRange]);

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

  const startEdit = useCallback((id: number, title: string) => {
    cancelEditRef.current = false;
    setEditingTimelineId(id);
    setEditTitle(title);
  }, []);

  const commitEdit = useCallback(() => {
    if (cancelEditRef.current) return;
    if (editingTimelineId !== null && editTitle.trim()) {
      renameTimeline(editingTimelineId, editTitle.trim());
    }
    setEditingTimelineId(null);
  }, [editingTimelineId, editTitle, renameTimeline]);

  const cancelEdit = useCallback(() => {
    cancelEditRef.current = true;
    setEditingTimelineId(null);
  }, []);

  const canAdd = timelines.length < MAX_TIMELINES;

  return (
    <aside className="w-full h-full bg-no-panel border-l border-no-border flex flex-col p-4 gap-5 overflow-y-auto panel-scroll">
      {/* Center year */}
      <div className="text-center">
        <div className="text-no-muted text-[12px] uppercase tracking-[0.15em] mb-1.5 font-medium">
          Center
        </div>
        <div className="text-no-text text-2xl font-mono font-semibold tracking-tight">
          {formatYear(centerYear)}
        </div>
      </div>

      <div className="h-px bg-no-border" />

      {/* Jump to year */}
      <div>
        <div className="text-no-muted text-[12px] uppercase tracking-[0.15em] mb-2.5 font-medium">
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

      {/* Date Range */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-no-muted text-[12px] uppercase tracking-[0.15em] font-medium">
            Date Range
          </div>
          {rangeActive && (
            <button
              onClick={handleClearRange}
              className="text-[9px] text-no-blue/70 hover:text-no-blue uppercase tracking-wider transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {rangeActive && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-no-blue/10 border border-no-blue/20">
            <div className="w-1.5 h-1.5 rounded-full bg-no-blue shrink-0" />
            <span className="text-no-blue/80 text-[12px] font-mono flex-1 truncate">
              {formatYear(rangeStart!)} — {formatYear(rangeEnd!)}
            </span>
          </div>
        )}

        <form onSubmit={handleApplyRange} className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-no-muted/60 text-[9px] uppercase tracking-[0.1em]">From</span>
              <input
                type="text"
                value={fromInput}
                onChange={(e) => { setFromInput(e.target.value); setFromError(false); }}
                placeholder="e.g. 500 BC"
                className={`w-full bg-no-card border rounded-lg px-2 py-1.5 text-no-text text-xs placeholder:text-no-muted/60 focus:outline-none transition-colors ${
                  fromError ? "border-red-500/60" : "border-no-border focus:border-no-blue/50"
                }`}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-no-muted/60 text-[9px] uppercase tracking-[0.1em]">To</span>
              <input
                type="text"
                value={toInput}
                onChange={(e) => { setToInput(e.target.value); setToError(false); }}
                placeholder="e.g. 500 AD"
                className={`w-full bg-no-card border rounded-lg px-2 py-1.5 text-no-text text-xs placeholder:text-no-muted/60 focus:outline-none transition-colors ${
                  toError ? "border-red-500/60" : "border-no-border focus:border-no-blue/50"
                }`}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!fromInput.trim() || !toInput.trim()}
            className="w-full bg-no-blue/10 hover:bg-no-blue/20 disabled:opacity-40 disabled:cursor-not-allowed text-no-blue text-sm font-semibold rounded-lg px-3 py-2 transition-colors border border-no-blue/20 hover:border-no-blue/40"
          >
            Apply Range
          </button>
        </form>
      </div>

      <div className="h-px bg-no-border" />

      {/* Timelines */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-no-muted text-[12px] uppercase tracking-[0.15em] font-medium">
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
            <div key={tl.id}>
              {editingTimelineId === tl.id ? (
                /* ── Inline rename row ── */
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-no-card border border-no-blue/50">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
                      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                    }}
                    onBlur={commitEdit}
                    maxLength={40}
                    className="flex-1 min-w-0 bg-transparent text-no-text text-xs outline-none"
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                    onClick={commitEdit}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-no-blue hover:bg-no-blue/10 transition-colors"
                  >
                    <Check size={11} />
                  </button>
                </div>
              ) : (
                /* ── Normal display row ── */
                <div className={`flex items-center gap-1 px-2.5 py-2 rounded-lg border border-no-border group transition-opacity ${tl.hidden ? "opacity-50 bg-no-card/40" : "bg-no-card"}`}>
                  <span className={`text-xs truncate leading-snug flex-1 ${tl.hidden ? "text-no-muted" : "text-no-text/70"}`}>{tl.title}</span>
                  <button
                    onClick={() => toggleTimelineHidden(tl.id!)}
                    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded transition-all ${
                      tl.hidden
                        ? "text-no-muted hover:text-no-blue hover:bg-no-blue/10"
                        : "text-no-muted/30 hover:text-no-muted hover:bg-no-border opacity-0 group-hover:opacity-100"
                    }`}
                    title={tl.hidden ? "Show timeline" : "Hide timeline"}
                  >
                    {tl.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                  <button
                    onClick={() => startEdit(tl.id!, tl.title)}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-no-muted/40 hover:text-no-blue hover:bg-no-blue/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Rename timeline"
                  >
                    <Pencil size={10} />
                  </button>
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
              <p className="text-no-muted/60 text-[12px]">{MAX_TIMELINES - timelines.length} slot remaining</p>
            )}
          </form>
        )}

        {!canAdd && !showAddForm && (
          <p className="text-no-muted/50 text-[12px]">Max {MAX_TIMELINES} timelines reached</p>
        )}
      </div>

      {/* Shortcuts */}
      <div className="mt-auto pt-2 border-t border-no-border/50">
        <div className="text-no-muted/50 text-[10px] uppercase tracking-[0.12em] font-medium mb-2.5">Shortcuts</div>
        <div className="flex flex-col gap-1.5">
          {/* 1/2/3 zoom levels */}
          {([
            ["1", "Centuries"],
            ["2", "Decades"],
            ["3", "Years"],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-no-card border border-no-border text-no-muted text-[11px] font-mono font-medium shrink-0">
                {key}
              </span>
              <span className="text-no-muted/70 text-[12px]">{label}</span>
            </div>
          ))}
          {/* Scroll shortcuts */}
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-no-card border border-no-border text-no-muted text-[10px] font-mono font-medium shrink-0 whitespace-nowrap">
              Scroll
            </span>
            <span className="text-no-muted/70 text-[12px]">Zoom</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-no-card border border-no-border text-no-muted text-[10px] font-mono font-medium shrink-0 whitespace-nowrap">
              ⇧ Scroll
            </span>
            <span className="text-no-muted/70 text-[12px]">Pan</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
