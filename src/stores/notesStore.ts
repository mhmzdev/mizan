import { create } from "zustand";
import { Note } from "@/types";
import { db } from "@/lib/db";

interface NotesState {
  notes: Note[];
  drawerOpen: boolean;
  editingNoteId: number | null;
  selectedYear: number;

  loadNotes: () => Promise<void>;
  openDrawer: (year: number, noteId?: number) => void;
  closeDrawer: () => void;
  saveNote: (data: { year: number; title: string; content: string }) => Promise<void>;
  updateNote: (id: number, changes: { title?: string; content?: string; year?: number }) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  drawerOpen: false,
  editingNoteId: null,
  selectedYear: 0,

  loadNotes: async () => {
    const notes = await db.notes.orderBy("year").toArray();
    set({ notes });
  },

  openDrawer: (year, noteId) => {
    set({ drawerOpen: true, selectedYear: year, editingNoteId: noteId ?? null });
  },

  closeDrawer: () => {
    set({ drawerOpen: false, editingNoteId: null });
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
