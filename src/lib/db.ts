import Dexie, { Table } from "dexie";
import { Note, Timeline } from "@/types";

class MizanDB extends Dexie {
  notes!: Table<Note>;
  timelines!: Table<Timeline>;

  constructor() {
    super("mizan");

    this.version(1).stores({
      notes: "++id, year",
    });

    this.version(2).stores({
      notes: "++id, year, timelineId",
      timelines: "++id",
    }).upgrade((trans) => {
      // Backfill existing notes to Global History (id will be 1)
      return trans.table("notes").toCollection().modify({ timelineId: 1 });
    });

    // Seed the two default timelines on first-ever database creation
    this.on("populate", () => {
      this.timelines.bulkAdd([
        { title: "Global History",       eventTrack: "global",   isDefault: true, createdAt: Date.now() },
        { title: "Personal Study Notes", eventTrack: "personal", isDefault: true, createdAt: Date.now() },
      ]);
    });

    // Guard for databases that were created at v1 and upgraded to v2 —
    // populate doesn't fire on upgrade, so ensure defaults exist on every open.
    this.on("ready", async () => {
      const count = await this.timelines.count();
      if (count === 0) {
        await this.timelines.bulkAdd([
          { title: "Global History",       eventTrack: "global",   isDefault: true, createdAt: Date.now() },
          { title: "Personal Study Notes", eventTrack: "personal", isDefault: true, createdAt: Date.now() },
        ]);
      }
    });
  }
}

export const db = new MizanDB();
