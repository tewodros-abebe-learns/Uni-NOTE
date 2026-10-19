import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocalValue, writeLocalValue, getStorageWarning, retryPendingWrites } from '../src/lib/localPersistence';
import { saveGuestNotes, loadGuestNotes, saveGuestFolders, loadGuestFolders } from '../src/demoData';
const disk = new Map<string, string>();
let full = false;
let removals = 0;
Object.assign(globalThis, { localStorage: {
  get length() { return disk.size; },
  key: (index: number) => [...disk.keys()][index] ?? null,
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { if (full) throw new DOMException('Full', 'QuotaExceededError'); disk.set(key, value); },
  removeItem: (key: string) => { removals++; disk.delete(key); },
}});

test('quota failures retain disk data and complete in-memory edits; retry recovers all', () => {
  writeLocalValue('uninote_media_cache', 'legacy-media-do-not-delete');
  writeLocalValue('test', 'old-disk');
  full = true;
  assert.equal(writeLocalValue('test', 'complete-new-data'), false);
  assert.equal(disk.get('test'), 'old-disk');
  assert.equal(readLocalValue('test'), 'complete-new-data');
  assert.match(getStorageWarning() || '', /Export a backup/);
  assert.equal(removals, 0);
  assert.equal(disk.get('uninote_media_cache'), 'legacy-media-do-not-delete');
  full = false;
  assert.equal(retryPendingWrites(), true);
  assert.equal(disk.get('test'), 'complete-new-data');
  assert.equal(getStorageWarning(), null);
});
test('a full vault never prunes the oldest notes or clears media', () => {
  const notes = Array.from({ length: 10 }, (_, index) => ({ id: `note_${index}`, title: String(index), folderId: 'folder', createdAt: index, sections: [{ id: 's', title: 'One', content: 'original' }] }));
  saveGuestNotes(notes);
  const original = disk.get('uninote_guest_notes');
  full = true;
  const updated = notes.map(note => ({ ...note, sections: [{ id: 's', title: 'One', content: 'updated' }] }));
  assert.equal(saveGuestNotes(updated), false);
  assert.equal(loadGuestNotes().length, 10);
  assert.ok(loadGuestNotes().every(note => note.sections[0].content === 'updated'));
  assert.equal(disk.get('uninote_guest_notes'), original);
  assert.equal(removals, 0);
  full = false; retryPendingWrites();
  assert.equal(JSON.parse(disk.get('uninote_guest_notes')!).length, 10);
});
test('intentional empty notes/folders persist without demo resurrection', () => {
  assert.equal(saveGuestNotes([]), true);
  assert.deepEqual(loadGuestNotes(), []);
  assert.equal(saveGuestFolders([]), true);
  assert.deepEqual(loadGuestFolders(), []);
  assert.equal(saveGuestNotes([], 'account'), true);
  assert.deepEqual(loadGuestNotes('account'), []);
});

test('account cache reads never implicitly merge guest notes or folders', () => {
  saveGuestNotes([{ id: 'guest_only', title: 'Guest', folderId: 'guest_folder', sections: [], createdAt: 1 }]);
  saveGuestFolders([{ id: 'guest_folder', name: 'Guest', parentId: null, level: 1, createdAt: 1 }]);
  saveGuestNotes([], 'isolated_user'); saveGuestFolders([], 'isolated_user');
  assert.deepEqual(loadGuestNotes('isolated_user'), []); assert.deepEqual(loadGuestFolders('isolated_user'), []);
});

test('known private mirrors left by older releases are hidden from Guest without discarding their source', () => {
  const privateNote = { id: 'legacy_private', title: 'Private', folderId: 'private_folder', sections: [], createdAt: 1 };
  const publicNote = { ...privateNote, id: 'public_guest', title: 'Public' };
  saveGuestNotes([privateNote], 'legacy_owner'); saveGuestNotes([privateNote, publicNote]);
  assert.deepEqual(loadGuestNotes().map(note => note.id), ['public_guest']);
  assert.equal(JSON.parse(disk.get('uninote_guest_notes')!).length, 2);
  assert.equal(JSON.parse(disk.get('uninote_legacy_account_mirrors')!)[0].id, 'legacy_private');
  saveGuestNotes(loadGuestNotes());
  assert.equal(loadGuestNotes('legacy_owner')[0].title, 'Private');
  assert.equal(JSON.parse(disk.get('uninote_legacy_account_mirrors')!)[0].title, 'Private');
});
