import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerLocalBlob, getLocalMediaBlob, initializeMediaVault, sanitizeContentImages, resolveLocalImage, dataUrlToBlob, hydrateMedia } from '../src/utils/mediaStore';
const disk = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  get length() { return disk.size; },
  key: (index: number) => [...disk.keys()][index] || null,
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => disk.set(key, value),
  removeItem: (key: string) => disk.delete(key),
}});

test('large images are durable Blobs; notes retain only tiny stable IDs', async () => {
  const blob = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/png' });
  const id = await registerLocalBlob(blob, 'large.png');
  assert.match(id, /^media_[a-f0-9]{64}\.png$/);
  assert.equal((await getLocalMediaBlob(id))?.size, blob.size);
  assert.equal(disk.size, 0);
  assert.ok(resolveLocalImage(id).startsWith('blob:'));
  assert.equal(await registerLocalBlob(blob, 'same-content.png'), id);
});
test('failed IndexedDB writes do not return a fake durable reference or remove existing media', async () => {
  const existing = await registerLocalBlob(new Blob(['existing'], { type: 'image/png' }));
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  try { await assert.rejects(registerLocalBlob(new Blob(['new'], { type: 'image/png' })), /Full/); }
  finally { IDBObjectStore.prototype.put = put; }
  assert.equal(await (await getLocalMediaBlob(existing))?.text(), 'existing');
});
test('legacy base64 cache migration retains original IDs and only deletes its source after success', async () => {
  const raw = JSON.stringify({ 'media_legacy.png': 'data:image/png;base64,YWJj' });
  disk.set('uninote_media_cache', raw);
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  try { await assert.rejects(initializeMediaVault(), /Full/); }
  finally { IDBObjectStore.prototype.put = put; }
  assert.equal(disk.get('uninote_media_cache'), raw);
  await initializeMediaVault();
  assert.equal(disk.has('uninote_media_cache'), false);
  assert.equal(await (await getLocalMediaBlob('media_legacy.png'))?.text(), 'abc');
  await hydrateMedia('![legacy](media_legacy.png)');
  assert.ok(resolveLocalImage('media_legacy.png').startsWith('blob:'));
});
test('inline base64 note migration keeps surrounding Markdown and commits images first', async () => {
  const content = 'Before\n![x](data:image/png;base64,YWJj) @@right:small@@\n$$x$$\nAfter';
  const migrated = await sanitizeContentImages(content);
  assert.ok(!migrated.includes('data:image'));
  assert.match(migrated, /Before\n!\[x\]\(media_[a-f0-9]{64}\.png\) @@right:small@@\n\$\$x\$\$\nAfter/);
  const id = migrated.match(/media_[a-f0-9]{64}\.png/)![0];
  assert.equal(await (await getLocalMediaBlob(id))?.text(), 'abc');
  disk.set('uninote_guest_notes', JSON.stringify([{ sections: [{ content }] }]));
  await initializeMediaVault();
  assert.ok(!disk.get('uninote_guest_notes')?.includes('data:image'));
});
test('invalid/oversized images are rejected instead of polluting note storage', async () => {
  assert.throws(() => dataUrlToBlob('not-an-image'), /Invalid/);
  await assert.rejects(registerLocalBlob(new Blob(['x'], { type: 'text/html' })), /image file/);
  await assert.rejects(registerLocalBlob(new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'image/png' })), /25 MB/);
});
