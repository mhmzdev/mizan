import {create} from "zustand";
import {Note, Timeline, TimelineEvent} from "@/types";
import {db} from "@/lib/db";

const LAST_TIMELINE_KEY = "mizan_last_timeline_id";

function readLastTimelineId(): number {
  if (typeof window === "undefined") return 1;
  return parseInt(localStorage.getItem(LAST_TIMELINE_KEY) ?? "1", 10) || 1;
}

function writeLastTimelineId(id: number) {
  if (typeof window !== "undefined") localStorage.setItem(LAST_TIMELINE_KEY, String(id));
}

export type PendingDelete =
  | { type: "note"; note: Note }
  | { type: "timeline"; timeline: Timeline; notes: Note[] };

interface NotesState {
  notes: Note[];
  timelines: Timeline[];
  drawerOpen: boolean;
  editingNoteId: number | null;
  selectedYear: number;
  /** Pre-filled title when opening the drawer from a global event dot. */
  pendingTitle: string;
  /** Full event object when opening from a global event — triggers annotation mode. */
  pendingSourceEvent: TimelineEvent | null;
  lastTimelineId: number;
  /** The timeline currently selected inside the open drawer — used to highlight the track. */
  drawerTimelineId: number | null;
  /** Stashed data for the last deletion — null means nothing pending. */
  pendingDelete: PendingDelete | null;

  loadNotes: () => Promise<void>;
  loadTimelines: () => Promise<void>;
  addTimeline: (title: string) => Promise<void>;
  renameTimeline: (id: number, title: string) => Promise<void>;
  deleteTimeline: (id: number) => Promise<void>;
  toggleTimelineHidden: (id: number) => Promise<void>;
  setLastTimelineId: (id: number) => void;
  setDrawerTimelineId: (id: number | null) => void;

  openDrawer: (year: number, noteId?: number, title?: string, sourceEvent?: TimelineEvent) => void;
  closeDrawer: () => void;
  saveNote: (data: {timelineId: number; year: number; title: string; content: string; sourceEventId?: string}) => Promise<void>;
  updateNote: (id: number, changes: {timelineId?: number; title?: string; content?: string; year?: number}) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;

  /** Re-insert the stashed item back into DB and restore it in state. */
  undoDelete: () => Promise<void>;
  /** Dismiss the undo toast without touching the DB (deletion already committed). */
  commitDelete: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  timelines: [],
  drawerOpen: false,
  editingNoteId: null,
  selectedYear: 0,
  pendingTitle: "",
  pendingSourceEvent: null,
  lastTimelineId: readLastTimelineId(),
  drawerTimelineId: null,
  pendingDelete: null,

  loadNotes: async () => {
    const notes = await db.notes.orderBy("year").toArray();
    set({notes});
  },

  loadTimelines: async () => {
    const timelines = await db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt));
    set({timelines});
  },

  addTimeline: async (title) => {
    const existing = await db.timelines.count();
    if (existing >= 5) return;
    await db.timelines.add({title: title.trim(), isDefault: false, createdAt: Date.now()});
    const timelines = await db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt));
    set({timelines});
  },

  renameTimeline: async (id, title) => {
    await db.timelines.update(id, {title: title.trim()});
    const timelines = await db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt));
    set({timelines});
  },

  toggleTimelineHidden: async (id) => {
    const tl = get().timelines.find((t) => t.id === id);
    if (!tl) return;
    await db.timelines.update(id, {hidden: !tl.hidden});
    const timelines = await db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt));
    set({timelines});
  },

  deleteTimeline: async (id) => {
    const { timelines, notes, lastTimelineId } = get();
    const timeline = timelines.find((t) => t.id === id);
    if (!timeline) return;

    const timelineNotes = notes.filter((n) => n.timelineId === id);
    const newTimelines  = timelines.filter((t) => t.id !== id);
    const newNotes      = notes.filter((n) => n.timelineId !== id);

    // Perform DB deletes
    await db.notes.where("timelineId").equals(id).delete();
    await db.timelines.delete(id);

    // Optimistically update state + stash for undo
    const stillExists = newTimelines.some((t) => t.id === lastTimelineId);
    const patch: Partial<NotesState> = {
      timelines: newTimelines,
      notes: newNotes,
      pendingDelete: { type: "timeline", timeline, notes: timelineNotes },
    };
    if (!stillExists) {
      writeLastTimelineId(1);
      patch.lastTimelineId = 1;
    }
    set(patch);
  },

  setLastTimelineId: (id) => {
    writeLastTimelineId(id);
    set({lastTimelineId: id});
  },

  setDrawerTimelineId: (id) => set({drawerTimelineId: id}),

  openDrawer: (year, noteId, title, sourceEvent) => {
    set({
      drawerOpen: true,
      selectedYear: year,
      editingNoteId: noteId ?? null,
      pendingTitle: title ?? "",
      pendingSourceEvent: sourceEvent ?? null,
    });
  },

  closeDrawer: () => {
    set({drawerOpen: false, editingNoteId: null, drawerTimelineId: null, pendingTitle: "", pendingSourceEvent: null});
  },

  saveNote: async (data) => {
    const now = Date.now();
    await db.notes.add({...data, createdAt: now, updatedAt: now});
    const notes = await db.notes.orderBy("year").toArray();
    set({notes});
  },

  updateNote: async (id, changes) => {
    await db.notes.update(id, {...changes, updatedAt: Date.now()});
    const notes = await db.notes.orderBy("year").toArray();
    set({notes});
  },

  deleteNote: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;

    await db.notes.delete(id);
    set({
      notes: get().notes.filter((n) => n.id !== id),
      pendingDelete: { type: "note", note },
    });
  },

  undoDelete: async () => {
    const pd = get().pendingDelete;
    if (!pd) return;
    // Dismiss the toast immediately
    set({ pendingDelete: null });

    if (pd.type === "note") {
      await db.notes.add(pd.note);
      const notes = [...get().notes, pd.note].sort((a, b) => a.year - b.year);
      set({ notes });
    } else {
      await db.timelines.add(pd.timeline);
      if (pd.notes.length > 0) await db.notes.bulkAdd(pd.notes);
      const timelines = [...get().timelines, pd.timeline].sort((a, b) => a.createdAt - b.createdAt);
      const notes     = [...get().notes, ...pd.notes].sort((a, b) => a.year - b.year);
      set({ timelines, notes });
    }
  },

  commitDelete: () => {
    // DB is already clean — just dismiss the toast.
    set({ pendingDelete: null });
  },
}));
