import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const disk = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  get length() { return disk.size; },
  key: (i: number) => [...disk.keys()][i] || null,
  getItem: (k: string) => disk.get(k) ?? null,
  setItem: (k: string, v: string) => disk.set(k, v),
  removeItem: (k: string) => disk.delete(k),
}});

/** Create exactly the broken state from the field: a v1 DB with NO object store. */
async function seedBrokenDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('uninote_media_db', 1); // no onupgradeneeded store creation
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
  const check = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('uninote_media_db', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.equal(check.objectStoreNames.contains('media'), false, 'precondition: store is missing');
  check.close();
}

test('media vault self-heals a legacy database that is missing its object store', async () => {
  await seedBrokenDatabase();
  const { registerLocalBlob, getLocalMediaBlob } = await import('../src/utils/mediaStore');
  const blob = new Blob(['healed'], { type: 'image/png' });
  const id = await registerLocalBlob(blob, 'healed.png'); // used to throw NotFoundError
  assert.match(id, /^media_[a-f0-9]{64}\.png$/);
  assert.equal(await (await getLocalMediaBlob(id))?.text(), 'healed');
});
