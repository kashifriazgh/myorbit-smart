// lib/memoryDB.ts
import Dexie from 'dexie';

export interface MemoryData {
  journalText: string;
  aiReflection: string;
  date: string;
  type: 'week' | 'month';
  createdAt: number;
}

class MemoryDB extends Dexie {
  memories!: Dexie.Table<MemoryData, number>;

  constructor() {
    super('MemoryJournalDB');
    this.version(1).stores({
      memories: '++id, type, date, createdAt',
    });
  }
}

export const dexieDB = new MemoryDB();
