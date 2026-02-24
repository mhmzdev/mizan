"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Search, StickyNote, X, ChevronDown, Check, MapPin } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { useMapStore } from "@/stores/mapStore";
import { useFormatYear } from "@/hooks/useFormatYear";
import { getTimelineColor, alphaColor } from "@/utils/timelineColors";
import { NoteCard } from "./NoteCard";
import { TimelineEvent } from "@/types";
import { PX_PER_YEAR } from "@/utils/constants";

const MAX_EVENT_RESULTS = 5;

interface NotesPanelProps {
  events: TimelineEvent[];
}

export function NotesPanel({ events }: NotesPanelProps) {
  const fmt        = useFormatYear();
  const notes      = useNotesStore((s) => s.notes);
  const timelines  = useNotesStore((s) => s.timelines);
  const openDrawer = useNotesStore((s) => s.openDrawer);
  const centerYear = useTimelineStore((s) => s.centerYear);
  const rangeStart = useTimelineStore((s) => s.rangeStart);
  const rangeEnd   = useTimelineStore((s) => s.rangeEnd);
  const clearRange = useTimelineStore((s) => s.clearRange);
  const rangeActive = rangeStart !== null && rangeEnd !== null;

  const search             = useNotesStore((s) => s.panelSearch);
  const setSearch          = useNotesStore((s) => s.setPanelSearch);
  const selectedTimelineId = useNotesStore((s) => s.panelTimelineId);
  const setSelectedTimelineId = useNotesStore((s) => s.setPanelTimelineId);
  const [dropdownOpen,       setDropdownOpen]       = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dropdownOpen]);

  // Clear timeline filter if that timeline is deleted or hidden
  useEffect(() => {
    if (selectedTimelineId === null) return;
    const tl = timelines.find((t) => t.id === selectedTimelineId);
    if (!tl || tl.hidden) setSelectedTimelineId(null);
  }, [timelines, selectedTimelineId]);

  const hiddenIds = new Set(timelines.filter((t) => t.hidden).map((t) => t.id!));
  const visibleTimelines = timelines.filter((t) => !t.hidden);

  const query = search.trim().toLowerCase();
  const filtered = notes
    .filter((n) => !hiddenIds.has(n.timelineId))
    .filter((n) => selectedTimelineId === null || n.timelineId === selectedTimelineId)
    .filter((n) => !rangeActive || (n.year >= rangeStart! && n.year <= rangeEnd!))
    .filter((n) => !query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query));

  // Global events shown only during search, pinned at top
  const matchedEvents = useMemo(() => {
    if (!query) return [];
    return events
      .filter((ev) => ev.title.toLowerCase().includes(query))
      .slice(0, MAX_EVENT_RESULTS);
  }, [query, events]);

  const viewMode = useMapStore((s) => s.viewMode);
  const visibleNotes = notes.filter((n) => !hiddenIds.has(n.timelineId));
  const unmappedCount = viewMode === "map" ? visibleNotes.filter((n) => !n.lat).length : 0;
  const showTabs = visibleNotes.length > 0 && visibleTimelines.length > 1;
  const isFiltered = query || rangeActive || selectedTimelineId !== null;
  const hasResults = filtered.length > 0 || matchedEvents.length > 0;

  function handleEventClick(ev: TimelineEvent) {
    useTimelineStore.getState().setPendingNav({ year: ev.year, zoom: PX_PER_YEAR.years });
    openDrawer(ev.year, undefined, ev.title, ev);
  }

  return (
    <aside data-tour="tour-notes" className="w-full h-full bg-no-panel border-r border-no-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-no-border shrink-0">
        <span className="text-no-muted text-[12px] uppercase tracking-[0.15em] font-semibold">
          Notes
        </span>
        <button
          onClick={() => openDrawer(centerYear)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
          title="New note"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Timeline filter dropdown */}
      {showTabs && (() => {
        const selTl = selectedTimelineId !== null ? visibleTimelines.find((t) => t.id === selectedTimelineId) : null;
        const selColor = selTl ? getTimelineColor(timelines.indexOf(selTl)) : null;
        return (
          <div ref={dropdownRef} className="relative px-2.5 py-2 border-b border-no-border shrink-0">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-no-card border border-no-border text-[12px] transition-colors hover:border-no-blue/30"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: selColor ?? "var(--color-no-muted)" }}
              />
              <span className={`flex-1 text-left truncate ${selTl ? "text-no-text" : "text-no-muted"}`}>
                {selTl ? selTl.title : "All Timelines"}
              </span>
              <ChevronDown
                size={11}
                className={`text-no-muted/60 shrink-0 transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute left-2.5 right-2.5 top-[calc(100%-4px)] bg-no-panel border border-no-border rounded-xl shadow-xl z-50 overflow-hidden">
                {/* All option */}
                <button
                  onClick={() => { setSelectedTimelineId(null); setDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors ${
                    selectedTimelineId === null
                      ? "text-no-text bg-no-card"
                      : "text-no-muted hover:bg-no-card/60 hover:text-no-text"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-no-muted/40" />
                  <span className="flex-1 text-left">All Timelines</span>
                  {selectedTimelineId === null && <Check size={10} className="shrink-0 text-no-blue" />}
                </button>

                {visibleTimelines.map((tl) => {
                  const i = timelines.indexOf(tl);
                  const color = getTimelineColor(i);
                  const isSelected = selectedTimelineId === tl.id;
                  return (
                    <button
                      key={tl.id}
                      onClick={() => { setSelectedTimelineId(isSelected ? null : tl.id!); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors ${
                        isSelected ? "bg-no-card" : "hover:bg-no-card/60"
                      }`}
                      style={{ color: isSelected ? color : undefined }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="flex-1 text-left truncate">{tl.title}</span>
                      {isSelected && <Check size={10} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Range filter badge */}
      {rangeActive && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-no-border shrink-0 bg-no-blue/5">
          <div className="w-1.5 h-1.5 rounded-full bg-no-blue shrink-0" />
          <span className="text-no-blue/75 text-[12px] font-mono flex-1 truncate">
            {fmt(rangeStart!)} — {fmt(rangeEnd!)}
          </span>
          <button
            onClick={clearRange}
            className="text-no-muted/50 hover:text-no-muted transition-colors"
            title="Clear range"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="px-2.5 py-2 border-b border-no-border shrink-0">
        <div className="relative flex items-center">
          <Search size={11} className="absolute left-2.5 text-no-muted/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events & notes…"
            className="w-full bg-no-card/60 border border-no-border/60 rounded-lg pl-7 pr-7 py-1.5 text-no-text text-[13px] placeholder:text-no-muted/60 focus:outline-none focus:border-no-blue/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 text-no-muted/40 hover:text-no-muted transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Unmapped notes badge — visible only in map mode */}
      {viewMode === "map" && unmappedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-no-border/50 bg-no-blue/5 shrink-0">
          <MapPin size={11} className="text-no-blue/60 shrink-0" />
          <span className="text-no-blue/70 text-[12px]">
            {unmappedCount} note{unmappedCount !== 1 ? "s" : ""} without location
          </span>
        </div>
      )}

      {/* List or empty state */}
      <div className="flex-1 overflow-y-auto panel-scroll">
        {visibleNotes.length === 0 && !query ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 text-center h-full">
            <StickyNote size={20} className="text-no-muted/25" />
            <div className="space-y-1">
              <p className="text-no-muted/50 text-xs">No notes yet</p>
              <p className="text-no-muted/35 text-[12px] leading-relaxed">
                Press + to create your first note
              </p>
            </div>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center h-full">
            <Search size={18} className="text-no-muted/20" />
            <p className="text-no-muted/40 text-xs">
              {query ? `No results for "${search}"` : "No notes in this range"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 p-2">
            {/* Global events — pinned at top during search */}
            {matchedEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => handleEventClick(ev)}
                className="relative w-full text-left px-3 py-3 rounded-xl bg-no-card hover:bg-no-border border border-no-border transition-all overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-no-blue/60" />
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-no-gold/80 text-[12px] font-mono">{fmt(ev.year)}</span>
                  <span className="text-[9px] uppercase tracking-wide font-medium text-no-blue/50">Historical</span>
                </div>
                <div className="text-no-text/90 text-xs font-medium leading-snug truncate">{ev.title}</div>
              </button>
            ))}

            {/* User notes */}
            {filtered.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}

            {isFiltered && filtered.length > 0 && (
              <p className="text-no-muted/35 text-[12px] text-center py-1">
                {filtered.length} of {visibleNotes.length} notes
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
