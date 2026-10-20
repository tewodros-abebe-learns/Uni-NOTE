import type { Note } from '../firebase';
import { readLocalValue, writeLocalValue } from './localPersistence';

/** Local 30-day trash for deleted notes. Deletion itself is unchanged (local
 *  removal + cloud tombstone); the trash only keeps a restorable copy. */
export interface TrashEntry { note: Note; deletedAt: number }
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const key = (uid?: string | null) => `uninote_trash_${uid || 'guest'}`;

export function listTrash(uid?: string | null, now = Date.now()): TrashEntry[] {
  try {
    const parsed = JSON.parse(readLocalValue(key(uid)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) => e && typeof e.deletedAt === 'number' && now - e.deletedAt < RETENTION_MS && e.note && typeof e.note.id === 'string');
  } catch { return []; }
}

function save(uid: string | null | undefined, entries: TrashEntry[]): boolean {
  return writeLocalValue(key(uid), JSON.stringify(entries));
}

export function addToTrash(uid: string | null | undefined, note: Note, now = Date.now()): boolean {
  const entries = listTrash(uid, now).filter(e => e.note.id !== note.id);
  return save(uid, [{ note: structuredClone(note), deletedAt: now }, ...entries]);
}

export function removeFromTrash(uid: string | null | undefined, noteId: string, now = Date.now()): TrashEntry[] {
  const entries = listTrash(uid, now).filter(e => e.note.id !== noteId);
  save(uid, entries);
  return entries;
}

/** Take an entry out of the trash for restoration (caller re-saves the note). */
export function takeFromTrash(uid: string | null | undefined, noteId: string, now = Date.now()): TrashEntry | null {
  const entries = listTrash(uid, now);
  const entry = entries.find(e => e.note.id === noteId) || null;
  if (entry) save(uid, entries.filter(e => e.note.id !== noteId));
  return entry;
}
