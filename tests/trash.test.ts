import { test } from 'node:test';
import assert from 'node:assert/strict';
const disk = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] || null,
  getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v), removeItem: (k: string) => disk.delete(k),
}});
const { listTrash, addToTrash, removeFromTrash, takeFromTrash } = await import('../src/lib/trash');
const note: any = { id: 'n1', folderId: 'f', title: 'T', createdAt: 1, sections: [{ id: 's', title: 'S', content: 'x' }] };
test('trash keeps, lists, restores and permanently removes notes per account', () => {
  assert.equal(addToTrash('alice', note, 1000), true);
  assert.equal(listTrash('alice', 1000).length, 1);
  assert.equal(listTrash('bob', 1000).length, 0, 'accounts are isolated');
  assert.equal(takeFromTrash('alice', 'n1', 1000)?.note.title, 'T');
  assert.equal(listTrash('alice', 1000).length, 0);
  addToTrash('alice', note, 1000); removeFromTrash('alice', 'n1', 1000);
  assert.equal(listTrash('alice', 1000).length, 0);
});
test('trash entries expire after 30 days', () => {
  addToTrash('alice', note, 0);
  assert.equal(listTrash('alice', 29 * 24 * 3600 * 1000).length, 1);
  assert.equal(listTrash('alice', 31 * 24 * 3600 * 1000).length, 0);
});
