import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const disk = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    get length() { return disk.size; },
    key: (i: number) => [...disk.keys()][i] || null,
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => disk.set(k, v),
    removeItem: (k: string) => disk.delete(k),
  },
});
const { registerLocalBlob, getLocalMediaBlob, resolveLocalImage } = await import('../src/utils/mediaStore');
const { updateMediaMarker, isMediaLine } = await import('../src/lib/sectionContent');
const { promoteMediaContent, getMediaReferences } = await import('../src/lib/mediaPromotion');
const { createVaultBackup, planVaultImport } = await import('../src/lib/vaultBackup');

const SOURCE = [
  '# Lecture',
  '![Diagram](media_abc123.png) @@right:small@@',
  '[youtube](https://www.youtube.com/watch?v=kYAdwS5MFjQ) @@left:medium@@',
  'Text with $E=mc^2$ inline.',
].join('\n');

test('remote URLs are never intercepted or blanked by local media resolution', () => {
  const storageUrl = 'https://firebasestorage.googleapis.com/v0/b/bkt/o/users%2Fu%2Fimages%2Fmedia_abc123.png?alt=media&token=t';
  assert.equal(resolveLocalImage(storageUrl), storageUrl);
  assert.equal(resolveLocalImage('https://example.com/pic.jpg'), 'https://example.com/pic.jpg');
  assert.equal(resolveLocalImage('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
});

test('layout markers survive insert-style edits for images and videos', () => {
  const lines = SOURCE.split('\n');
  assert.ok(isMediaLine(lines[1]) && isMediaLine(lines[2]));
  assert.equal(updateMediaMarker(lines[1], 'left', 'full'), '![Diagram](media_abc123.png) @@left:full@@');
  assert.equal(updateMediaMarker(lines[2], 'center', 'large'), '[youtube](https://www.youtube.com/watch?v=kYAdwS5MFjQ) @@center:large@@');
});

test('cloud promotion rewrites only the image reference; markers and videos are byte-identical', async () => {
  const promoted = await promoteMediaContent(SOURCE, async id => `https://storage.example/${id}?token=x`);
  assert.ok(promoted.includes('![Diagram](https://storage.example/media_abc123.png?token=x) @@right:small@@'), promoted);
  assert.ok(promoted.includes('[youtube](https://www.youtube.com/watch?v=kYAdwS5MFjQ) @@left:medium@@'));
  assert.deepEqual(getMediaReferences(promoted), []);
  // A layout change still lands on the promoted line afterwards.
  const line = promoted.split('\n')[1];
  assert.equal(updateMediaMarker(line, 'center', 'medium'), '![Diagram](https://storage.example/media_abc123.png?token=x) @@center:medium@@');
});

test('export embeds local image bytes and import restores the exact section source', async () => {
  const blob = new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' });
  const id = await registerLocalBlob(blob, 'diagram.png');
  const content = SOURCE.replace('media_abc123.png', id);
  const note: any = { id: 'n1', folderId: 'f1', title: 'T', createdAt: 1, sections: [{ id: 's1', title: 'S', content }] };
  const backup = await createVaultBackup([note], [], getLocalMediaBlob);
  assert.ok(backup.media[id]?.startsWith('data:image/png;base64,'), 'image bytes embedded');
  assert.equal(backup.notes[0].sections[0].content, content, 'source untouched by export');

  const plan = planVaultImport(backup, 'dest', () => 'uuid-1');
  assert.equal(plan.notes[0].sections[0].content, content, 'markers and media survive import planning');
  assert.equal(plan.media[id], backup.media[id]);
});

test('export of a note whose image is absent locally fails loudly, never silently', async () => {
  const note: any = { id: 'n2', folderId: 'f1', title: 'T', createdAt: 1, sections: [{ id: 's1', title: 'S', content: SOURCE }] };
  await assert.rejects(createVaultBackup([note], [], async () => null), /Cannot export missing image/);
});
