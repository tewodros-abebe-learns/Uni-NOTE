import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'] });
console.log(`Stage 2 browser: ${browser.version()}; Node: ${process.version}`);
const errors = [];
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=';
const originalSections = ['One', 'Two', 'Three'].map((name, index) => ({ id: `section_${index}`, title: name, content: `# Before ${name}\n\n![Existing](/icon.svg) @@left-small@@\n\nMiddle ${name} $E=mc^2$\n\n$$\n\\frac{a}{b}\n$$\n\n[youtube](https://youtu.be/kYAdwS5MFjQ) @@right:medium@@\n\nAfter ${name}\n` }));
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const isolateServices = async route => {
    const url = route.request().url();
    if (new URL(url).origin === new URL(origin).origin) return route.continue();
    if (url.includes('/katex@')) {
      const path = url.split('/dist/')[1];
      if (['katex.min.js', 'contrib/auto-render.min.js', 'katex.min.css'].includes(path)) return route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : 'application/javascript', body: readFileSync(new URL(`../node_modules/katex/dist/${path}`, import.meta.url)) });
    }
    return route.abort();
  };
  await context.route('**/*', isolateServices);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('input[accept=".json,.md,.markdown,.txt"]').setInputFiles({ name: 'stage2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ title: 'Stage 2 Integrity', sections: originalSections })) });
  await page.getByRole('heading', { name: 'Stage 2 Integrity', exact: true }).waitFor();
  const noteId = new URL(page.url()).searchParams.get('noteId');
  assert.ok(noteId);
  const saved = () => page.evaluate(id => JSON.parse(localStorage.getItem('uninote_guest_notes')).find(note => note.id === id), noteId);
  const rawInput = () => page.getByRole('textbox', { name: 'Raw section Markdown', exact: true });
  const edit = async () => { if (!(await rawInput().count()) && !(await page.locator('textarea[data-segment-index]').count())) await page.getByTitle('Edit Note', { exact: true }).first().click(); };
  const selectSection = async number => {
    await page.getByTitle('Open Sections', { exact: true }).click();
    await page.getByRole('button', { name: `${number + 1}. ${originalSections[number].title}`, exact: true }).click();
  };
  const findBlock = async text => {
    for (const textarea of await page.locator('textarea[data-segment-index]').all()) if ((await textarea.inputValue()).includes(text)) return textarea;
    throw new Error(`No block containing ${text}`);
  };
  await edit();
  await rawInput().focus();
  await rawInput().evaluate(element => element.setSelectionRange(element.value.length, element.value.length));
  for (let i = 0; i < 2; i++) {
    const transfer = await page.evaluateHandle(({ png, i }) => {
      const bytes = Uint8Array.from(atob(png), char => char.charCodeAt(0));
      const padding = new Uint8Array(3 * 1024 * 1024); padding[0] = i;
      const transfer = new DataTransfer(); transfer.items.add(new File([bytes, padding], `screenshot-${i}.png`, { type: 'image/png' }));
      return transfer;
    }, { png, i });
    if (i === 0) await rawInput().dispatchEvent('drop', { dataTransfer: transfer });
    else await rawInput().evaluate((element, transfer) => element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })), transfer);
    await page.waitForFunction(({ id, count }) => {
      const note = JSON.parse(localStorage.getItem('uninote_guest_notes')).find(note => note.id === id);
      return (note.sections[0].content.match(/media_[a-f0-9]{64}/g) || []).length === count;
    }, { id: noteId, count: i + 1 });
  }
  let expected = (await saved()).sections.map(section => section.content);
  const mediaStats = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('uninote_media_db', 1);
    request.onsuccess = () => {
      const read = request.result.transaction('media').objectStore('media').getAll();
      read.onsuccess = () => { resolve({ count: read.result.length, bytes: read.result.reduce((sum, media) => sum + media.blob.size, 0), notesBytes: new Blob([localStorage.getItem('uninote_guest_notes')]).size, legacy: localStorage.getItem('uninote_media_cache') }); request.result.close(); };
      read.onerror = () => reject(read.error);
    };
    request.onerror = () => reject(request.error);
  }));
  assert.equal(mediaStats.count, 2); assert.ok(mediaStats.bytes > 6 * 1024 * 1024);
  assert.ok(mediaStats.notesBytes < 50 * 1024); assert.equal(mediaStats.legacy, null);
  console.log('PASS: actual drop + clipboard paste save >6 MB of PNG Blobs to IndexedDB; note vault stays <50 KB');

  await page.getByTitle('Switch to Structured Box View').click();
  const middle = await findBlock('Middle One');
  await middle.fill((await middle.inputValue()).replace('Middle One', 'Middle One edited'));
  expected[0] = expected[0].replace('Middle One', 'Middle One edited');
  // Opening/switching sections flushes immediately, without waiting for debounce.
  await selectSection(1);
  assert.equal((await saved()).sections[0].content, expected[0]);
  const two = await findBlock('Middle Two');
  await two.fill((await two.inputValue()).replace('Middle Two', 'Middle Two edited'));
  expected[1] = expected[1].replace('Middle Two', 'Middle Two edited');
  await selectSection(2);
  const three = await findBlock('Middle Three');
  await three.fill((await three.inputValue()).replace('Middle Three', 'Middle Three edited'));
  expected[2] = expected[2].replace('Middle Three', 'Middle Three edited');
  await selectSection(0);
  assert.deepEqual((await saved()).sections.map(section => section.content), expected);
  console.log('PASS: edits and all neighboring text, math, images and video survive switching among three sections');

  const after = await findBlock('After One');
  await after.focus();
  await after.evaluate(element => { const start = element.value.indexOf('After One'); element.setSelectionRange(start, start + 'After One'.length); element.dispatchEvent(new Event('select', { bubbles: true })); });
  await page.getByTitle('Underline Text', { exact: true }).click();
  expected[0] = expected[0].replace('After One', '<u>After One</u>');
  await page.getByTitle('Save Note', { exact: true }).first().click();
  assert.equal((await saved()).sections[0].content, expected[0]);
  console.log('PASS: structured formatting maps local slice selection to the full document without truncation');

  await page.getByTitle('Go to Home').click();
  await page.getByText('Eigenvalues & Diagonalization', { exact: true }).first().click();
  await page.getByRole('heading', { name: 'Eigenvalues & Diagonalization', exact: true }).waitFor();
  await page.getByTitle('Go to Home').click();
  await page.getByText('Stage 2 Integrity', { exact: true }).first().click();
  assert.deepEqual((await saved()).sections.map(section => section.content), expected);
  await page.waitForFunction(() => [...document.querySelectorAll('img[src^="blob:"]')].length === 2 && [...document.querySelectorAll('img[src^="blob:"]')].every(image => image.complete && image.naturalWidth > 0));
  console.log('PASS: leaving to root, opening another note, and returning preserves exact section content and loaded images');

  await edit();
  await rawInput().fill(expected[0] + '\nRefresh flush');
  expected[0] += '\nRefresh flush';
  const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Stage 2 Integrity', exact: true }).waitFor();
  assert.deepEqual((await saved()).sections.map(section => section.content), expected);
  await page.waitForFunction(() => document.querySelectorAll('.katex').length > 0 && document.querySelectorAll('iframe[src^="https://www.youtube-nocookie.com/embed/"]').length > 0 && [...document.querySelectorAll('img[src^="blob:"]')].length === 2 && [...document.querySelectorAll('img[src^="blob:"]')].every(image => image.complete && image.naturalWidth > 0));
  console.log('PASS: cache-disabled reload flushes the latest edit and rehydrates PNG Blobs, video embeds and KaTeX');

  await page.getByTitle('Go to Home').click();
  await page.getByText('Stage 2 Integrity', { exact: true }).first().click();
  await edit(); await rawInput().fill(expected[0] + '\nHistory flush'); expected[0] += '\nHistory flush';
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.getByText('Quantum Physics', { exact: true }).first().waitFor();
  assert.equal((await saved()).sections[0].content, expected[0]);
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Stage 2 Integrity', exact: true }).waitFor();
  assert.equal((await saved()).sections[0].content, expected[0]);
  console.log('PASS: browser back/forward flushes the departing note and restores the intended note');

  // Delay one actual image hash to exercise completion after unmounting its editor.
  await edit();
  await rawInput().focus();
  await rawInput().evaluate(element => element.setSelectionRange(element.value.length, element.value.length));
  await page.evaluate(() => {
    window.__originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (...args) => new Promise((resolve, reject) => {
      window.__releaseDigest = () => { crypto.subtle.digest = window.__originalDigest; window.__originalDigest(...args).then(resolve, reject); };
    });
  });
  const lateTransfer = await page.evaluateHandle(png => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(atob(png), char => char.charCodeAt(0))], 'late-image.png', { type: 'image/png' }));
    return transfer;
  }, png);
  await rawInput().evaluate((element, transfer) => element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })), lateTransfer);
  await page.waitForFunction(() => Boolean(window.__releaseDigest));
  await page.getByTitle('Go to Home').click();
  await page.getByText('Eigenvalues & Diagonalization', { exact: true }).first().click();
  await edit();
  const otherContent = (await rawInput().inputValue()) + '\nOther note concurrent edit';
  await rawInput().fill(otherContent);
  await page.evaluate(() => window.__releaseDigest());
  await page.waitForFunction(id => {
    const note = JSON.parse(localStorage.getItem('uninote_guest_notes')).find(note => note.id === id);
    return (note.sections[0].content.match(/media_[a-f0-9]{64}/g) || []).length === 3;
  }, noteId);
  assert.equal(await rawInput().inputValue(), otherContent);
  const afterLate = (await saved()).sections.map(section => section.content);
  assert.ok(afterLate[0].startsWith(expected[0]));
  assert.deepEqual(afterLate.slice(1), expected.slice(1));
  expected = afterLate;
  await page.getByTitle('Go to Home').click();
  await page.getByText('Stage 2 Integrity', { exact: true }).first().click();
  console.log('PASS: a delayed image insertion returns to its original note/section and does not overwrite the concurrently edited next note');

  const diskBefore = await page.evaluate(() => localStorage.getItem('uninote_guest_notes'));
  await edit();
  await page.evaluate(() => {
    window.__originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.includes('notes')) throw new DOMException('Full', 'QuotaExceededError'); return window.__originalSetItem.call(this, key, value); };
  });
  await rawInput().fill(expected[0] + '\nQuota recovery edit'); expected[0] += '\nQuota recovery edit';
  await page.getByTitle('Save Note', { exact: true }).first().click();
  await page.getByRole('alert').filter({ hasText: 'Storage warning:' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('uninote_guest_notes')), diskBefore);
  assert.ok(await page.getByText('Quota recovery edit', { exact: false }).count());
  await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Storage warning:' }).waitFor({ state: 'hidden' });
  assert.deepEqual((await saved()).sections.map(section => section.content), expected);
  console.log('PASS: quota failure leaves old disk notes intact, warns visibly, retains complete edits in memory and retries successfully');
  await edit();
  const beforeFailedImage = await rawInput().inputValue();
  await page.evaluate(() => {
    window.__originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function() { throw new DOMException('Image storage full', 'QuotaExceededError'); };
  });
  await rawInput().dispatchEvent('drop', { dataTransfer: lateTransfer });
  await page.getByText('Image could not be saved: Image storage full', { exact: true }).waitFor();
  assert.equal(await rawInput().inputValue(), beforeFailedImage);
  assert.deepEqual((await saved()).sections.map(section => section.content), expected);
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__originalPut; });
  console.log('PASS: a failed IndexedDB image transaction inserts no broken reference and leaves existing note content untouched');

  // A fresh page validates the real startup migration and subsequent reload.
  await page.close();
  const legacyContext = context;
  await legacyContext.addInitScript(({ png, origin }) => {
    if (location.origin !== origin) return;
    if (localStorage.getItem('stage2_legacy_seeded')) return;
    localStorage.setItem('stage2_legacy_seeded', 'true');
    localStorage.setItem('uninote_media_cache', JSON.stringify({ 'media_legacy.png': `data:image/png;base64,${png}` }));
    localStorage.setItem('uninote_guest_notes', JSON.stringify([{ id: 'stage2_legacy', title: 'Legacy media note', folderId: 'demo_folder_physics', createdAt: 1, sections: [{ id: 'legacy_section', title: 'Legacy section', content: `# Legacy content\n\n![legacy](media_legacy.png) @@left-small@@\n\n![inline](data:image/png;base64,${png}) @@right:small@@\n\nAfter legacy` }] }]));
  }, { png, origin: new URL(origin).origin });
  const legacyPage = await legacyContext.newPage();
  legacyPage.on('pageerror', error => errors.push(error.message));
  await legacyPage.goto(`${origin}/?noteId=stage2_legacy`, { waitUntil: 'domcontentloaded' });
  await legacyPage.waitForFunction(() => [...document.querySelectorAll('img[src^="blob:"]')].length === 2 && [...document.querySelectorAll('img[src^="blob:"]')].every(image => image.complete && image.naturalWidth > 0));
  assert.equal(await legacyPage.evaluate(() => localStorage.getItem('uninote_media_cache')), null);
  const migrated = await legacyPage.evaluate(() => localStorage.getItem('uninote_guest_notes'));
  assert.ok(!migrated.includes('data:image/')); assert.ok(migrated.includes('media_legacy.png')); assert.ok(migrated.includes('After legacy'));
  await legacyPage.reload({ waitUntil: 'domcontentloaded' });
  await legacyPage.waitForFunction(() => [...document.querySelectorAll('img[src^="blob:"]')].length === 2 && [...document.querySelectorAll('img[src^="blob:"]')].every(image => image.complete && image.naturalWidth > 0));
  await legacyPage.close();
  console.log('PASS: legacy cache IDs and inline base64 migrate into real IndexedDB Blobs and still load after a second startup');

  assert.deepEqual(errors, []);
  console.log('PASS: zero uncaught browser errors; no authentication or cloud data mutations performed');
  await context.close();
} finally { await browser.close(); }
