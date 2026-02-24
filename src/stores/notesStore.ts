import {create} from "zustand";
import {Note, Timeline, TimelineEvent} from "@/types";
import {db} from "@/lib/db";
import {useTimelineStore} from "@/stores/timelineStore";
import {useMapStore} from "@/stores/mapStore";

export interface ExportPayload {
  version: 1;
  exportedAt: number;
  timelines: Timeline[];
  notes: Note[];
}

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
  /** Mirrors NotesPanel search → drives map pin filter. */
  panelSearch: string;
  /** Mirrors NotesPanel timeline dropdown → drives map pin filter. */
  panelTimelineId: number | null;
  /** Lat pre-fill when opening the drawer from a map tap on empty area. */
  pendingLat: number | null;
  pendingLng: number | null;

  loadNotes: () => Promise<void>;
  loadTimelines: () => Promise<void>;
  addTimeline: (title: string) => Promise<void>;
  renameTimeline: (id: number, title: string) => Promise<void>;
  deleteTimeline: (id: number) => Promise<void>;
  toggleTimelineHidden: (id: number) => Promise<void>;
  setLastTimelineId: (id: number) => void;
  setDrawerTimelineId: (id: number | null) => void;

  openDrawer: (year: number, noteId?: number, title?: string, sourceEvent?: TimelineEvent, pendingLat?: number, pendingLng?: number) => void;
  setPanelSearch: (q: string) => void;
  setPanelTimelineId: (id: number | null) => void;
  closeDrawer: () => void;
  saveNote: (data: {timelineId: number; year: number; title: string; content: string; sourceEventId?: string; lat?: number; lng?: number; locationAccuracy?: number}) => Promise<void>;
  updateNote: (id: number, changes: {timelineId?: number; title?: string; content?: string; year?: number; lat?: number | null; lng?: number | null; locationAccuracy?: number | null}) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  linkNotes: (noteId: number, partnerId: number) => Promise<void>;
  unlinkNotes: (noteId: number) => Promise<void>;
  clearBrokenLink: (noteId: number) => Promise<void>;
  importData: (payload: ExportPayload) => Promise<void>;

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
  panelSearch: "",
  panelTimelineId: null,
  pendingLat: null,
  pendingLng: null,

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

  setPanelSearch: (q) => set({ panelSearch: q }),
  setPanelTimelineId: (id) => set({ panelTimelineId: id }),

  openDrawer: (year, noteId, title, sourceEvent, pendingLat, pendingLng) => {
    // Update active interval overlay if opening a linked note
    if (noteId !== undefined) {
      const notes = get().notes;
      const note = notes.find((n) => n.id === noteId);
      if (note?.linkedNoteId) {
        const partner = notes.find((n) => n.id === note.linkedNoteId);
        if (partner) {
          const start = Math.min(note.year, partner.year);
          const end   = Math.max(note.year, partner.year);
          useTimelineStore.getState().setActiveInterval({ start, end });
        } else {
          useTimelineStore.getState().setActiveInterval(null);
        }
      } else {
        useTimelineStore.getState().setActiveInterval(null);
      }
    } else {
      useTimelineStore.getState().setActiveInterval(null);
    }
    set({
      drawerOpen: true,
      selectedYear: year,
      editingNoteId: noteId ?? null,
      pendingTitle: title ?? "",
      pendingSourceEvent: sourceEvent ?? null,
      pendingLat: pendingLat ?? null,
      pendingLng: pendingLng ?? null,
    });
  },

  closeDrawer: () => {
    useTimelineStore.getState().setActiveInterval(null);
    useMapStore.getState().setLocationPickMode(false);
    useMapStore.getState().setDrawerPreviewPin(null);
    set({drawerOpen: false, editingNoteId: null, drawerTimelineId: null, pendingTitle: "", pendingSourceEvent: null, pendingLat: null, pendingLng: null});
  },

  saveNote: async (data) => {
    const now = Date.now();
    await db.notes.add({...data, createdAt: now, updatedAt: now});
    const notes = await db.notes.orderBy("year").toArray();
    set({notes});
  },

  updateNote: async (id, changes) => {
    if ("lat" in changes && changes.lat == null) {
      // Remove optional location fields — db.update() can't set them to null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.notes.where("id").equals(id).modify((obj: any) => {
        delete obj.lat; delete obj.lng; delete obj.locationAccuracy;
      });
      // Apply remaining non-location changes
      const { lat: _lat, lng: _lng, locationAccuracy: _acc, ...rest } = changes;
      // Build a clean object without null values for Dexie UpdateSpec
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cleanRest: Record<string, any> = { updatedAt: Date.now() };
      for (const [k, v] of Object.entries(rest)) {
        if (v !== null && v !== undefined) cleanRest[k] = v;
      }
      await db.notes.update(id, cleanRest);
    } else {
      // Strip any null values before passing to Dexie (lat undefined = no change)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clean: Record<string, any> = { updatedAt: Date.now() };
      for (const [k, v] of Object.entries(changes)) {
        if (v !== null && v !== undefined) clean[k] = v;
      }
      await db.notes.update(id, clean);
    }
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

  linkNotes: async (noteId, partnerId) => {
    const now = Date.now();
    await db.notes.update(noteId,   { linkedNoteId: partnerId, updatedAt: now });
    await db.notes.update(partnerId, { linkedNoteId: noteId,    updatedAt: now });
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
    const noteA = notes.find((n) => n.id === noteId);
    const noteB = notes.find((n) => n.id === partnerId);
    if (noteA && noteB) {
      useTimelineStore.getState().setActiveInterval({
        start: Math.min(noteA.year, noteB.year),
        end:   Math.max(noteA.year, noteB.year),
      });
    }
  },

  unlinkNotes: async (noteId) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note?.linkedNoteId) return;
    const partnerId = note.linkedNoteId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.notes.where("id").equals(noteId)    .modify((obj: any) => { delete obj.linkedNoteId; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.notes.where("id").equals(partnerId) .modify((obj: any) => { delete obj.linkedNoteId; });
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
    useTimelineStore.getState().setActiveInterval(null);
  },

  clearBrokenLink: async (noteId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.notes.where("id").equals(noteId).modify((obj: any) => { delete obj.linkedNoteId; });
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
  },

  importData: async (payload) => {
    // Wipe existing data
    await db.notes.clear();
    await db.timelines.clear();

    // Re-import timelines — track origId → newId for remapping
    const timelineIdMap = new Map<number, number>();
    for (const tl of payload.timelines) {
      const { id: origId, ...tlData } = tl;
      const newId = await db.timelines.add(tlData as Timeline);
      if (origId !== undefined) timelineIdMap.set(origId, newId as number);
    }

    // Re-import notes (without linkedNoteId first) — track origId → newId
    const noteIdMap = new Map<number, number>();
    for (const note of payload.notes) {
      const { id: origId, linkedNoteId: _linked, ...noteData } = note;
      const newTimelineId = timelineIdMap.get(noteData.timelineId) ?? noteData.timelineId;
      const newId = await db.notes.add({ ...noteData, timelineId: newTimelineId } as Note);
      if (origId !== undefined) noteIdMap.set(origId, newId as number);
    }

    // Remap linkedNoteIds using both ID maps
    for (const note of payload.notes) {
      if (!note.id || !note.linkedNoteId) continue;
      const newNoteId    = noteIdMap.get(note.id);
      const newPartnerId = noteIdMap.get(note.linkedNoteId);
      if (newNoteId && newPartnerId) {
        await db.notes.update(newNoteId, { linkedNoteId: newPartnerId });
      }
    }

    // Reload store state
    const timelines = await db.timelines.toArray().then((ts) => ts.sort((a, b) => a.createdAt - b.createdAt));
    const notes     = await db.notes.orderBy("year").toArray();
    const firstId   = timelines[0]?.id ?? 1;
    writeLastTimelineId(firstId);
    set({ timelines, notes, lastTimelineId: firstId, pendingDelete: null });
    useTimelineStore.getState().setActiveInterval(null);
  },
}));
