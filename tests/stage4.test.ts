import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { planVaultImport, createVaultBackup, backupMarkdown } from '../src/lib/vaultBackup';
import { updateMediaMarker, parseContentIntoSegments } from '../src/lib/sectionContent';
import { renderNoteMath } from '../src/lib/math';
import { highlightSearch } from '../src/lib/searchHighlight';
const dom = new JSDOM('<!doctype html><body></body>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, NodeFilter: dom.window.NodeFilter, Node: dom.window.Node });
const { getMediaLayoutStyles } = await import('../src/lib/renderContent');
const note = (id: string, content = '# Body') => ({ id, title: id, folderId: 'folder', createdAt: 123, updatedAt: 456, sections: [{ id: 's', title: 'One', content }] });
let counter = 0;
const id = () => String(++counter);
test('imports every note from arrays without replacing timestamps or source sections', () => {
  const result = planVaultImport([note('A'), note('B')], 'destination', id);
  assert.equal(result.notes.length, 2); assert.equal(result.notes[0].createdAt, 123); assert.equal(result.notes[1].updatedAt, 456);
  assert.deepEqual(result.notes.map(n => n.title), ['A', 'B']); assert.notEqual(result.notes[0].id, 'A');
  assert.equal(result.notes[0].folderId, 'destination');
});
test('flat folder tree and nested folder notes remap all parent/note references', () => {
  const result = planVaultImport({ folders: [{ id: 'root', name: 'Root', notes: [note('A')], children: [{ id: 'child', name: 'Child', notes: [note('B')] }] }], notes: [{ ...note('C'), folderId: 'child' }] }, 'destination', id);
  const root = result.folders.find(f => f.name === 'Root')!; const child = result.folders.find(f => f.name === 'Child')!;
  assert.equal(child.parentId, root.id); assert.equal(result.notes.find(n => n.title === 'A')!.folderId, root.id);
  assert.equal(result.notes.find(n => n.title === 'B')!.folderId, child.id); assert.equal(result.notes.find(n => n.title === 'C')!.folderId, child.id);
});
test('rejects cycles, duplicates, malformed sections and unsupported versions before applying changes', () => {
  assert.throws(() => planVaultImport({ folders: [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }] }, 'd'), /cycle/);
  assert.throws(() => planVaultImport([note('A'), note('A')], 'd'), /duplicate/);
  assert.throws(() => planVaultImport({ folders: [{ id: 'a' }, { id: 'a' }] }, 'd'), /Duplicate/);
  assert.throws(() => planVaultImport({ title: 'Broken', sections: [{ content: 99 }] }, 'd'), /content/);
  assert.throws(() => planVaultImport({ format: 'uninote-vault', version: 99, notes: [note('A')] }, 'd'), /version/);
});
test('accepts legacy content and sectionsArray and preserves Firestore-style timestamps', () => {
  const result = planVaultImport([{ title: 'Legacy', content: 'Original' }, { ...note('T'), createdAt: { seconds: 4, nanoseconds: 7 }, sections: undefined, sectionsArray: note('T').sections }], 'd', id);
  assert.equal(result.notes[0].sections[0].content, 'Original'); assert.deepEqual(result.notes[1].createdAt, { seconds: 4, nanoseconds: 7 });
});
test('portable JSON includes deduplicated local image bytes and roundtrips notes/folders', async () => {
  const notes = [note('A', '![a](media_shared.png) @@right:full@@'), note('B', '![b](media_shared.png)')];
  let reads = 0; const backup = await createVaultBackup(notes, [{ id: 'folder', name: 'Folder', parentId: null, level: 0, createdAt: 1 }], async () => { reads++; return new Blob(['image'], { type: 'image/png' }); });
  assert.equal(reads, 1); assert.equal(backup.media['media_shared.png'], 'data:image/png;base64,aW1hZ2U=');
  const restored = planVaultImport(JSON.parse(JSON.stringify(backup)), 'd', id);
  assert.equal(restored.notes.length, 2); assert.equal(restored.notes[0].sections[0].content, notes[0].sections[0].content);
  assert.equal(restored.notes[0].folderId, restored.folders[0].id);
  assert.ok(backupMarkdown(backup).includes('data:image/png;base64,aW1hZ2U='));
  assert.ok(backupMarkdown(backup).includes('# B'));
});
test('missing images fail export instead of falsely claiming a complete backup', async () => {
  await assert.rejects(createVaultBackup([note('A', '![a](media_missing.png)')], [], async () => null), /missing image/);
});
test('Full is canonical, safe and distinct from Large for images and video', () => {
  const source = updateMediaMarker('![x](x.png) @@right-large@@', 'left', 'full');
  assert.equal(source, '![x](x.png) @@left:full@@'); assert.equal(parseContentIntoSegments(source)[0].media?.size, 'full');
  assert.equal(getMediaLayoutStyles('left', 'large').widthPercent, '85%');
  assert.equal(getMediaLayoutStyles('right', 'full', true).widthPercent, '100%');
});
test('bundled math renders inline, display and environments without global scripts', () => {
  const element = document.createElement('div'); element.textContent = '$E=mc^2$ and $$\\frac{a}{b}$$ and \\begin{pmatrix}a&b\\end{pmatrix}';
  renderNoteMath(element); assert.equal(element.querySelectorAll('.katex').length, 3);
  assert.equal(element.querySelectorAll('.katex-display').length, 2);
});
test('invalid math stays readable and untrusted KaTeX commands cannot create script URLs', () => {
  const element = document.createElement('div'); element.textContent = '$\\badcommand{x}$ $\\href{javascript:alert(1)}{click}$';
  renderNoteMath(element); assert.equal(element.querySelectorAll('a[href^="javascript:"]').length, 0); assert.ok(element.textContent?.includes('badcommand'));
});
test('search changes highlight/clear safely while preserving math and media identity', () => {
  const element = document.createElement('div'); element.innerHTML = '<p>Alpha alpha beta &lt;img&gt;</p><iframe></iframe><span class="katex">alpha</span>';
  const frame = element.querySelector('iframe');
  assert.equal(highlightSearch(element, 'alpha', 1), 2); assert.equal(element.querySelectorAll('.search-match-active').length, 1);
  assert.equal(highlightSearch(element, 'beta'), 1); assert.equal(element.querySelector('iframe'), frame);
  assert.equal(highlightSearch(element, '<img>'), 1); assert.equal(element.querySelectorAll('img').length, 0);
  highlightSearch(element, ''); assert.equal(element.querySelectorAll('mark').length, 0); assert.equal(element.querySelector('.katex')?.textContent, 'alpha');
});
test('HTML export escapes metadata, renders MathML and omits editing controls and scripts', async () => {
  const { backupHtml } = await import('../src/lib/htmlExport');
  const backup = await createVaultBackup([{ ...note('<script>alert(1)</script>', '$x^2$\n\n<img src=x onerror=alert(1)>') }], [], async () => null);
  const html = backupHtml(backup); const parsed = new JSDOM(html).window.document;
  assert.equal(parsed.querySelectorAll('script,[onerror],.media-adjust-trigger').length, 0);
  assert.equal(parsed.querySelector('h1')?.textContent, '<script>alert(1)</script>'); assert.ok(parsed.querySelector('math'));
  assert.ok(parsed.querySelector('meta[http-equiv="Content-Security-Policy"]'));
});

test('PWA install choice is handled once and installed events update the drawer state', async () => {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false }), configurable: true });
  const pwa = await import('../src/lib/pwa'); pwa.setupPwa();
  assert.equal(await pwa.installPwa(), 'manual');
  let prompts = 0; const event = new dom.window.Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt: async () => { prompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  dom.window.dispatchEvent(event); assert.equal(event.defaultPrevented, true); assert.equal(pwa.getPwaState().installAvailable, true);
  assert.equal(await pwa.installPwa(), 'dismissed'); assert.equal(prompts, 1); assert.equal(await pwa.installPwa(), 'manual');
  let updates = 0; pwa.offerPwaUpdate(async () => { updates++; }); assert.equal(pwa.getPwaState().updateAvailable, true); assert.equal(updates, 0);
  await pwa.applyPwaUpdate(); assert.equal(updates, 1);
  dom.window.dispatchEvent(new dom.window.Event('appinstalled')); assert.equal(await pwa.installPwa(), 'installed');
});

test('ISO timestamps and the epoch remain unchanged while malformed timestamps are rejected', () => {
  const result = planVaultImport([{ ...note('ISO'), createdAt: '2026-10-18T12:00:00.000Z', updatedAt: 0 }], 'd', id);
  assert.equal(result.notes[0].createdAt, '2026-10-18T12:00:00.000Z'); assert.equal(result.notes[0].updatedAt, 0);
  assert.throws(() => planVaultImport([{ ...note('Bad'), createdAt: { seconds: 1, nanoseconds: 'bad' } }], 'd'), /timestamp/);
});
test('non-raster HTML image export refuses omission and points to lossless formats', async () => {
  const { backupHtml } = await import('../src/lib/htmlExport');
  const backup = await createVaultBackup([note('SVG', '![svg](media_vector.svg)')], [], async () => new Blob(['<svg/>'], { type: 'image/svg+xml' }));
  assert.throws(() => backupHtml(backup), /choose JSON or Markdown/);
});

test('oversized portable exports fail before allocating image base64 data', async () => {
  const oversized = { size: 40 * 1024 * 1024, type: 'image/png', arrayBuffer: async () => { throw new Error('Must not allocate'); } } as unknown as Blob;
  await assert.rejects(createVaultBackup([note('Big', '![image](media_big.png)')], [], async () => oversized), /exceeds 50 MB/);
});
