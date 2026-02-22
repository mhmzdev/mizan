"use client";

import React, { useState } from "react";
import { Plus, Search, StickyNote, X } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { NoteCard } from "./NoteCard";

export function NotesPanel() {
  const notes      = useNotesStore((s) => s.notes);
  const openDrawer = useNotesStore((s) => s.openDrawer);
  const centerYear = useTimelineStore((s) => s.centerYear);

  const [search, setSearch] = useState("");

  const query    = search.trim().toLowerCase();
  const filtered = query
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query)
      )
    : notes;

  return (
    <aside className="w-full h-full bg-no-panel border-r border-no-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-no-border shrink-0">
        <span className="text-no-muted text-[10px] uppercase tracking-[0.15em] font-semibold">
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

      {/* Search bar — only shown when there are notes */}
      {notes.length > 0 && (
        <div className="px-2.5 py-2 border-b border-no-border shrink-0">
          <div className="relative flex items-center">
            <Search size={11} className="absolute left-2.5 text-no-muted/50 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full bg-no-card/60 border border-no-border/60 rounded-lg pl-7 pr-7 py-1.5 text-no-text text-[11px] placeholder:text-no-muted/60 focus:outline-none focus:border-no-blue/40 transition-colors"
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
      )}

      {/* List or empty state */}
      <div className="flex-1 overflow-y-auto panel-scroll">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 text-center h-full">
            <StickyNote size={20} className="text-no-muted/25" />
            <div className="space-y-1">
              <p className="text-no-muted/50 text-xs">No notes yet</p>
              <p className="text-no-muted/35 text-[10px] leading-relaxed">
                Press + to create your first note
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center h-full">
            <Search size={18} className="text-no-muted/20" />
            <p className="text-no-muted/40 text-xs">No results for "{search}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 p-2">
            {filtered.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
            {query && (
              <p className="text-no-muted/35 text-[10px] text-center py-1">
                {filtered.length} of {notes.length} notes
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
