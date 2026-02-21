import Dexie, { Table } from "dexie";
import { Note } from "@/types";

class MizanDB extends Dexie {
  notes!: Table<Note>;

  constructor() {
    super("mizan");
    this.version(1).stores({
      notes: "++id, year",
    });
  }
}

export const db = new MizanDB();
