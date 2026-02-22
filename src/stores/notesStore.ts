import { create } from "zustand";
import { Note, Timeline } from "@/types";
import { db } from "@/lib/db";

const LAST_TIMELINE_KEY = "mizan_last_timeline_id";

function readLastTimelineId(): number {
  if (typeof window === "undefined") return 1;
  return parseInt(localStorage.getItem(LAST_TIMELINE_KEY) ?? "1", 10) || 1;
}

function writeLastTimelineId(id: number) {
  if (typeof window !== "undefined") localStorage.setItem(LAST_TIMELINE_KEY, String(id));
}

interface NotesState {
  notes: Note[];
  timelines: Timeline[];
  drawerOpen: boolean;
  editingNoteId: number | null;
  selectedYear: number;
  lastTimelineId: number;
  /** The timeline currently selected inside the open drawer — used to highlight the track. */
  drawerTimelineId: number | null;

  loadNotes: () => Promise<void>;
  loadTimelines: () => Promise<void>;
  addTimeline: (title: string) => Promise<void>;
  deleteTimeline: (id: number) => Promise<void>;
  setLastTimelineId: (id: number) => void;
  setDrawerTimelineId: (id: number | null) => void;

  openDrawer: (year: number, noteId?: number) => void;
  closeDrawer: () => void;
  saveNote: (data: { timelineId: number; year: number; title: string; content: string }) => Promise<void>;
  updateNote: (id: number, changes: { timelineId?: number; title?: string; content?: string; year?: number }) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  timelines: [],
  drawerOpen: false,
  editingNoteId: null,
  selectedYear: 0,
  lastTimelineId: readLastTimelineId(),
  drawerTimelineId: null,

  loadNotes: async () => {
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
  },

  loadTimelines: async () => {
    const timelines = await db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt));
    set({ timelines });
  },

  addTimeline: async (title) => {
    const existing = await db.timelines.count();
    if (existing >= 5) return;
    await db.timelines.add({ title: title.trim(), isDefault: false, createdAt: Date.now() });
    const timelines = await db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt));
    set({ timelines });
  },

  deleteTimeline: async (id) => {
    // Delete all notes belonging to this timeline, then delete the timeline
    await db.notes.where("timelineId").equals(id).delete();
    await db.timelines.delete(id);
    const [timelines, notes] = await Promise.all([
      db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt)),
      db.notes.orderBy("year").toArray(),
    ]);
    // If last selected timeline was deleted, fall back to 1
    const lastId = get().lastTimelineId;
    const stillExists = timelines.some((t) => t.id === lastId);
    if (!stillExists) {
      writeLastTimelineId(1);
      set({ timelines, notes, lastTimelineId: 1 });
    } else {
      set({ timelines, notes });
    }
  },

  setLastTimelineId: (id) => {
    writeLastTimelineId(id);
    set({ lastTimelineId: id });
  },

  setDrawerTimelineId: (id) => set({ drawerTimelineId: id }),

  openDrawer: (year, noteId) => {
    set({ drawerOpen: true, selectedYear: year, editingNoteId: noteId ?? null });
  },

  closeDrawer: () => {
    set({ drawerOpen: false, editingNoteId: null, drawerTimelineId: null });
  },

  saveNote: async (data) => {
    const now = Date.now();
    await db.notes.add({ ...data, createdAt: now, updatedAt: now });
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
  },

  updateNote: async (id, changes) => {
    await db.notes.update(id, { ...changes, updatedAt: Date.now() });
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
  },

  deleteNote: async (id) => {
    await db.notes.delete(id);
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
  },
}));
