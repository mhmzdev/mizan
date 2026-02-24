"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { X, Link, Check, ChevronDown, Trash2, Lock, Link2, Link2Off, ArrowRight, AlertTriangle, Search, MapPin, Map } from "lucide-react";
import { getTimelineColor } from "@/utils/timelineColors";
import { motion, AnimatePresence } from "framer-motion";
import { useNotesStore } from "@/stores/notesStore";
import { useDialogStore } from "@/stores/dialogStore";
import { useMapStore } from "@/stores/mapStore";
import { useFormatYear } from "@/hooks/useFormatYear";
import { buildNoteUrl } from "@/hooks/useUrlSync";
import { MarkdownEditor } from "./MarkdownEditor";

const MIN_DRAWER_W = 320;
const MAX_DRAWER_W = 700;
const STORAGE_KEY = "mizan_drawer_width";

function parseYearInput(raw: string): number | null {
  const t = raw.trim().toUpperCase();
  let year: number;

  if (t.endsWith("BCE") || t.endsWith("BC")) {
    const suffix = t.endsWith("BCE") ? "BCE" : "BC";
    const num = parseInt(t.slice(0, -suffix.length).trim(), 10);
    if (isNaN(num)) return null;
    year = -num;
  } else if (t.endsWith("CE") || t.endsWith("AD")) {
    const suffix = t.endsWith("CE") ? "CE" : "AD";
    const num = parseInt(t.slice(0, -suffix.length).trim(), 10);
    if (isNaN(num)) return null;
    year = num - 1;
  } else if (t.endsWith("AH")) {
    const ah = parseInt(t.slice(0, -2).trim(), 10);
    if (isNaN(ah)) return null;
    const ce = Math.round(622 + (ah - 1) / 1.030684);
    year = ce >= 1 ? ce - 1 : ce;
  } else if (t.endsWith("BH")) {
    const bh = parseInt(t.slice(0, -2).trim(), 10);
    if (isNaN(bh)) return null;
    const ce = Math.round(622 - bh / 1.030684);
    year = ce >= 1 ? ce - 1 : ce;
  } else {
    const num = parseInt(t, 10);
    if (isNaN(num)) return null;
    year = num > 0 ? num - 1 : -num;
  }

  return Math.max(-4000, Math.min(2025, year));
}

const inputClass =
  "w-full bg-no-bg/60 border border-no-border/70 rounded-lg px-3 py-2 text-no-text text-sm placeholder:text-no-muted/50 focus:outline-none focus:border-no-blue/50 transition-colors";

const labelClass = "text-no-muted text-[12px] uppercase tracking-[0.12em] font-medium mb-1";

interface NoteDrawerProps {
  panelWidth: number;
  isMobile?: boolean;
  instantLeft?: boolean; // skip left animation during panel resize
}

export function NoteDrawer({ panelWidth, isMobile, instantLeft }: NoteDrawerProps) {
  const fmt               = useFormatYear();
  const drawerOpen        = useNotesStore((s) => s.drawerOpen);
  const editingNoteId     = useNotesStore((s) => s.editingNoteId);
  const selectedYear      = useNotesStore((s) => s.selectedYear);
  const pendingTitle      = useNotesStore((s) => s.pendingTitle);
  const notes             = useNotesStore((s) => s.notes);
  const timelines         = useNotesStore((s) => s.timelines);
  const lastTimelineId    = useNotesStore((s) => s.lastTimelineId);
  const pendingSourceEvent   = useNotesStore((s) => s.pendingSourceEvent);
  const closeDrawer       = useNotesStore((s) => s.closeDrawer);
  const saveNote          = useNotesStore((s) => s.saveNote);
  const updateNote        = useNotesStore((s) => s.updateNote);
  const deleteNote        = useNotesStore((s) => s.deleteNote);
  const linkNotes         = useNotesStore((s) => s.linkNotes);
  const unlinkNotes       = useNotesStore((s) => s.unlinkNotes);
  const clearBrokenLink   = useNotesStore((s) => s.clearBrokenLink);
  const setLastTimelineId    = useNotesStore((s) => s.setLastTimelineId);
  const setDrawerTimelineId  = useNotesStore((s) => s.setDrawerTimelineId);

  const [yearInput,      setYearInput]     = useState("");
  const [yearError,      setYearError]     = useState(false);
  const [title,          setTitle]         = useState("");
  const [content,        setContent]       = useState("");
  const [timelineId,     setTimelineId]    = useState<number>(lastTimelineId);
  const [linkCopied,     setLinkCopied]    = useState(false);
  const [sourceEventId,  setSourceEventId] = useState<string | null>(null);
  const [formKey,        setFormKey]       = useState(0);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkSearch,     setLinkSearch]    = useState("");
  const [lat,            setLat]           = useState<number | null>(null);
  const [lng,            setLng]           = useState<number | null>(null);

  const pendingLat          = useNotesStore((s) => s.pendingLat);
  const pendingLng          = useNotesStore((s) => s.pendingLng);

  const viewMode              = useMapStore((s) => s.viewMode);
  const setDrawerPreviewPin   = useMapStore((s) => s.setDrawerPreviewPin);
  const pendingLocationPick   = useMapStore((s) => s.pendingLocationPick);

  const isEventAnnotation = sourceEventId !== null;

  // Resizable drawer width
  const [drawerWidth, setDrawerWidth] = useState(MIN_DRAWER_W);
  const isResizingRef = useRef(false);

  // Timeline dropdown
  const [timelineDropdownOpen, setTimelineDropdownOpen] = useState(false);
  const timelineDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!timelineDropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (!timelineDropdownRef.current?.contains(e.target as Node)) setTimelineDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [timelineDropdownOpen]);

  // Restore drawer width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setDrawerWidth(Math.max(MIN_DRAWER_W, Math.min(MAX_DRAWER_W, parseInt(saved))));
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    setFormKey((k) => k + 1); // force MarkdownEditor remount with correct content
    let resolvedTimelineId = lastTimelineId;
    if (editingNoteId !== null) {
      const note = notes.find((n) => n.id === editingNoteId);
      if (note) {
        setYearInput(fmt(note.year));
        setTitle(note.title);
        setContent(note.content);
        resolvedTimelineId = note.timelineId;
        setTimelineId(note.timelineId);
        setSourceEventId(note.sourceEventId ?? null);
        setLat(note.lat ?? null);
        setLng(note.lng ?? null);
      }
    } else {
      setYearInput(fmt(selectedYear));
      setTitle(pendingTitle);
      setContent("");
      setTimelineId(lastTimelineId);
      setSourceEventId(pendingSourceEvent?.id ?? null);
      setLat(pendingLat ?? null);
      setLng(pendingLng ?? null);
    }
    setYearError(false);
    setLinkPickerOpen(false);
    setLinkSearch("");
    setDrawerTimelineId(resolvedTimelineId);
  }, [drawerOpen, editingNoteId, pendingTitle, selectedYear, pendingSourceEvent, pendingLat, pendingLng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consume location pick from map (crosshair tap) → fill lat/lng in form
  useEffect(() => {
    if (!pendingLocationPick) return;
    setLat(parseFloat(pendingLocationPick.lat.toFixed(6)));
    setLng(parseFloat(pendingLocationPick.lng.toFixed(6)));
    useMapStore.getState().setPendingLocationPick(null);
  }, [pendingLocationPick]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTimelineChange = useCallback((id: number) => {
    setTimelineId(id);
    setLastTimelineId(id);
    setDrawerTimelineId(id);
  }, [setLastTimelineId, setDrawerTimelineId]);

  // Sync preview pin with current lat/lng state
  useEffect(() => {
    setDrawerPreviewPin(
      lat !== null && lng !== null
        ? { lat, lng, noteId: editingNoteId }
        : null
    );
  }, [lat, lng, editingNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear preview pin when drawer closes
  useEffect(() => {
    if (!drawerOpen) setDrawerPreviewPin(null);
  }, [drawerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    const parsedYear = parseYearInput(yearInput);
    if (parsedYear === null) { setYearError(true); return; }

    if (editingNoteId !== null) {
      await updateNote(editingNoteId, { timelineId, year: parsedYear, title: title.trim(), content, lat: lat ?? null, lng: lng ?? null });
    } else {
      await saveNote({
        timelineId,
        year: parsedYear,
        title: title.trim(),
        content,
        ...(sourceEventId ? { sourceEventId } : {}),
        ...(lat !== null ? { lat, lng: lng! } : {}),
      });
    }
    closeDrawer();
  }, [yearInput, title, content, timelineId, editingNoteId, sourceEventId, lat, lng, saveNote, updateNote, closeDrawer]);

  const handleCopyNoteLink = useCallback(() => {
    if (editingNoteId === null) return;
    const note = notes.find((n) => n.id === editingNoteId);
    if (!note) return;
    navigator.clipboard.writeText(buildNoteUrl(editingNoteId, note.year)).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [editingNoteId, notes]);

  const handleDelete = useCallback(async () => {
    if (editingNoteId === null) return;
    const ok = await useDialogStore.getState().confirm({
      title: "Delete note?",
      message: "This note will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    await deleteNote(editingNoteId);
    closeDrawer();
  }, [editingNoteId, deleteNote, closeDrawer]);

  function startResizeDrawer(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const startX = e.clientX;
    const startW = drawerWidth;
    function onMove(ev: MouseEvent) {
      setDrawerWidth(Math.max(MIN_DRAWER_W, Math.min(MAX_DRAWER_W, startW + ev.clientX - startX)));
    }
    function onUp(ev: MouseEvent) {
      const w = Math.max(MIN_DRAWER_W, Math.min(MAX_DRAWER_W, startW + ev.clientX - startX));
      setDrawerWidth(w);
      localStorage.setItem(STORAGE_KEY, String(w));
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // Shared inner content — reused by both mobile and desktop variants
  const drawerBody = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-no-border shrink-0">
        <span className="text-no-text/50 text-[12px] uppercase tracking-[0.15em] font-semibold flex-1">
          {editingNoteId !== null ? "Edit Note" : "New Note"}
        </span>

        {editingNoteId !== null && (
          <button
            onClick={handleCopyNoteLink}
            title="Copy note link"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors"
          >
            {linkCopied
              ? <Check size={12} className="text-green-400" />
              : <Link size={12} />
            }
          </button>
        )}

        <button
          onClick={closeDrawer}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-no-muted hover:text-no-text hover:bg-no-card transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col overflow-y-auto panel-scroll min-h-0">

        {/* ── Metadata: Timeline + Year ── */}
        <div className="flex flex-col gap-2.5 px-4 pt-4 pb-4 border-b border-no-border/50">
          {/* Custom Timeline dropdown */}
          {(() => {
            const idx   = timelines.findIndex((t) => t.id === timelineId);
            const color = idx >= 0 ? getTimelineColor(idx) : "var(--color-no-muted)";
            const name  = idx >= 0 ? timelines[idx].title : "Select timeline";
            return (
              <div ref={timelineDropdownRef} className="relative">
                <button
                  onClick={() => setTimelineDropdownOpen((v) => !v)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-no-card border border-no-border text-[12px] transition-colors hover:border-no-blue/30"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="flex-1 text-left truncate text-no-text">{name}</span>
                  <ChevronDown
                    size={11}
                    className={`text-no-muted/60 shrink-0 transition-transform duration-150 ${timelineDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {timelineDropdownOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-no-panel border border-no-border rounded-xl shadow-xl z-50 overflow-hidden">
                    {timelines.map((tl, i) => {
                      const c    = getTimelineColor(i);
                      const isSel = tl.id === timelineId;
                      return (
                        <button
                          key={tl.id}
                          onClick={() => { handleTimelineChange(tl.id!); setTimelineDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors ${isSel ? "bg-no-card" : "hover:bg-no-card/60"}`}
                          style={{ color: isSel ? c : undefined }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                          <span className="flex-1 text-left truncate">{tl.title}</span>
                          {isSel && <Check size={10} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Year */}
          <div>
            {isEventAnnotation ? (
              <div className="w-full flex items-center gap-2 px-3 py-2 bg-no-bg/40 border border-no-border/40 rounded-lg">
                <Lock size={10} className="text-no-muted/40 shrink-0" />
                <span className="text-no-text/60 text-sm font-mono">{yearInput}</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={yearInput}
                  onChange={(e) => { setYearInput(e.target.value); setYearError(false); }}
                  placeholder="e.g. 500 BC or 1066 AD"
                  className={`${inputClass} font-mono ${yearError ? "border-red-500/60 focus:border-red-500" : ""}`}
                />
                {yearError && (
                  <p className="text-red-400 text-[12px] mt-1">Enter a valid year — e.g. &quot;500 BC&quot; or &quot;1066 AD&quot;</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Location section (always shown — button adapts to context) ── */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-no-border/50">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Location</span>
            {viewMode === "map" ? (
              /* In map view — "Set location" triggers pick mode */
              <button
                onClick={() => useMapStore.getState().setLocationPickMode(true)}
                className="flex items-center gap-1.5 text-[11px] text-no-blue/70 hover:text-no-blue transition-colors"
              >
                <MapPin size={11} />
                <span>Set location</span>
              </button>
            ) : lat !== null ? (
              /* In timeline view with coords — "Go to map" centers + switches */
              <button
                onClick={() => {
                  useMapStore.getState().setMapCenter({ lat: lat!, lng: lng! });
                  useMapStore.getState().setViewMode("map");
                }}
                className="flex items-center gap-1.5 text-[11px] text-no-blue/70 hover:text-no-blue transition-colors"
              >
                <Map size={11} />
                <span>Go to map</span>
              </button>
            ) : (
              /* In timeline view with no coords — "Set location" switches to map + pick */
              <button
                onClick={() => {
                  useMapStore.getState().setViewMode("map");
                  useMapStore.getState().setLocationPickMode(true);
                }}
                className="flex items-center gap-1.5 text-[11px] text-no-blue/70 hover:text-no-blue transition-colors"
              >
                <MapPin size={11} />
                <span>Set location</span>
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-no-bg/60 border border-no-border/70 rounded-lg px-2.5 py-1.5 text-no-text text-[12px] font-mono min-w-0">
              {lat !== null ? (
                <span>{lat.toFixed(4)}° lat</span>
              ) : (
                <span className="text-no-muted/40">No location</span>
              )}
            </div>
            {lng !== null && lat !== null && (
              <div className="flex-1 bg-no-bg/60 border border-no-border/70 rounded-lg px-2.5 py-1.5 text-no-text text-[12px] font-mono min-w-0">
                <span>{lng.toFixed(4)}° lng</span>
              </div>
            )}
            {lat !== null && (
              <button
                onClick={() => { setLat(null); setLng(null); }}
                title="Clear location"
                className="w-6 h-6 flex items-center justify-center rounded text-no-muted/50 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* ── Content: Title + Notes — one continuous unit ── */}
        <div className="flex flex-col px-4 pt-5 pb-4">
          {isEventAnnotation ? (
            <>
              {/* Locked title — shows the historical event name */}
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-no-text text-[1.4rem] font-semibold leading-snug">{title}</p>
                </div>
                <div className="flex items-center gap-1 mt-1.5 shrink-0 bg-no-card border border-no-border/60 rounded px-1.5 py-0.5">
                  <Lock size={9} className="text-no-muted/50" />
                  <span className="text-no-muted/50 text-[9px] uppercase tracking-[0.1em] font-medium">Historical</span>
                </div>
              </div>
            </>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-transparent text-no-text text-[1.4rem] font-semibold placeholder:text-no-muted/35 outline-none mb-4 leading-snug"
            />
          )}
          <div className="flex items-center gap-1 mb-2">
            <span className="text-no-muted/35 text-[11px] uppercase tracking-[0.12em]">
              {isEventAnnotation ? "Your notes" : "Markdown supported"}
            </span>
          </div>
          <MarkdownEditor key={formKey} value={content} onChange={setContent} />
        </div>

        {/* ── Link section (edit mode only) ── */}
        {editingNoteId !== null && (() => {
          const currentNote = notes.find((n) => n.id === editingNoteId);
          const partnerId   = currentNote?.linkedNoteId;

          if (partnerId) {
            const partner = notes.find((n) => n.id === partnerId);

            if (partner) {
              // Linked and partner exists
              return (
                <div className="px-4 py-3 border-t border-no-border/50">
                  <p className={labelClass}>Linked note</p>
                  <div className="flex items-center gap-2 px-2.5 py-2 bg-no-card rounded-lg border border-no-border">
                    <span className="text-no-blue/80 text-[12px] shrink-0">↔</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-no-text text-[12px] font-medium truncate">{partner.title}</p>
                      <p className="text-no-muted/60 text-[11px] font-mono">{fmt(partner.year)}</p>
                    </div>
                    <button
                      onClick={() => { useNotesStore.getState().openDrawer(partner.year, partner.id!); }}
                      title="Go to linked note"
                      className="w-6 h-6 flex items-center justify-center rounded text-no-muted hover:text-no-blue hover:bg-no-blue/10 transition-colors shrink-0"
                    >
                      <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={() => unlinkNotes(editingNoteId)}
                      title="Unlink notes"
                      className="w-6 h-6 flex items-center justify-center rounded text-no-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Link2Off size={12} />
                    </button>
                  </div>
                </div>
              );
            } else {
              // Partner was deleted
              return (
                <div className="px-4 py-3 border-t border-no-border/50">
                  <p className={labelClass}>Linked note</p>
                  <div className="flex items-center gap-2 px-2.5 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                    <span className="flex-1 text-amber-400/80 text-[12px]">Linked note no longer exists</span>
                    <button
                      onClick={() => clearBrokenLink(editingNoteId)}
                      className="text-amber-400/60 hover:text-amber-400 text-[11px] transition-colors shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              );
            }
          } else if (linkPickerOpen) {
            // Link picker open
            const candidates = notes.filter(
              (n) => n.id !== editingNoteId && !n.linkedNoteId
            );
            const q = linkSearch.trim().toLowerCase();
            const shown = q
              ? candidates.filter((n) => n.title.toLowerCase().includes(q) || fmt(n.year).toLowerCase().includes(q))
              : candidates;

            return (
              <div className="px-4 py-3 border-t border-no-border/50">
                <div className="flex items-center justify-between mb-2">
                  <p className={labelClass}>Link to note</p>
                  <button
                    onClick={() => { setLinkPickerOpen(false); setLinkSearch(""); }}
                    className="text-no-muted/50 hover:text-no-muted transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="relative mb-2">
                  <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-no-muted/50 pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder="Search notes…"
                    className="w-full bg-no-card border border-no-border rounded-lg pl-7 pr-3 py-1.5 text-no-text text-[12px] placeholder:text-no-muted/50 focus:outline-none focus:border-no-blue/40 transition-colors"
                  />
                </div>
                <div className="max-h-[140px] overflow-y-auto panel-scroll flex flex-col gap-0.5">
                  {shown.length === 0 ? (
                    <p className="text-no-muted/40 text-[12px] text-center py-2">
                      {candidates.length === 0 ? "No unlinkable notes available" : "No results"}
                    </p>
                  ) : (
                    shown.map((n) => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          await linkNotes(editingNoteId, n.id!);
                          setLinkPickerOpen(false);
                          setLinkSearch("");
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-no-card text-left transition-colors"
                      >
                        <span className="text-no-muted/60 text-[11px] font-mono shrink-0 w-[60px] truncate">{fmt(n.year)}</span>
                        <span className="text-no-text text-[12px] truncate">{n.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          } else {
            // Not linked, picker closed
            return (
              <div className="px-4 py-3 border-t border-no-border/50">
                <button
                  onClick={() => setLinkPickerOpen(true)}
                  className="flex items-center gap-1.5 text-no-muted/50 hover:text-no-blue text-[12px] transition-colors"
                >
                  <Link2 size={11} />
                  <span>Link to another note</span>
                </button>
              </div>
            );
          }
        })()}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-4 border-t border-no-border shrink-0">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="flex-1 bg-no-blue hover:bg-no-blue-dim disabled:opacity-40 disabled:cursor-not-allowed text-no-blue-fg text-sm font-semibold rounded-lg px-3 py-2.5 transition-colors"
        >
          Save
        </button>
        {editingNoteId !== null && (
          <button
            onClick={handleDelete}
            title="Delete note"
            className="w-10 h-10 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20 shrink-0"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {drawerOpen && (
        isMobile ? (
          /* ── Mobile: full-screen overlay, slides up from bottom ── */
          <motion.div
            key="mobile-drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 bg-no-bg flex flex-col z-[70]"
            onClick={(e) => e.stopPropagation()}
          >
            {drawerBody}
          </motion.div>
        ) : (
          /* ── Desktop: slides in from the left, beside the notes panel ── */
          <>
            <motion.div
              key="desktop-drawer"
              initial={{ x: -12, opacity: 0, left: panelWidth }}
              animate={{ x: 0,   opacity: 1, left: panelWidth }}
              exit={{   x: -12, opacity: 0 }}
              transition={{
                x:       { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                left:    instantLeft ? { duration: 0 } : { type: "tween", duration: 0.22, ease: [0.4, 0, 0.2, 1] },
              }}
              className="absolute top-0 bottom-0 bg-no-bg/80 backdrop-blur-md border-r border-no-border/60 flex flex-col z-[55] supports-[backdrop-filter]:bg-no-bg/75"
              style={{ width: drawerWidth, boxShadow: "var(--drawer-shadow)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {drawerBody}

              {/* Resize handle — right edge */}
              <div
                className="absolute top-0 bottom-0 right-[-5px] w-[10px] z-[56] cursor-col-resize select-none group"
                onMouseDown={startResizeDrawer}
              >
                <div className="absolute inset-y-0 left-[4px] w-px bg-no-blue/0 group-hover:bg-no-blue/50 transition-colors duration-150" />
              </div>
            </motion.div>
          </>
        )
      )}
    </AnimatePresence>
  );
}
