// Component integration with a deliberately substituted Firebase adapter, NOT live authentication.
// Run a Vite source server at :3001; production regression checks are separate scripts.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const origin = process.env.STAGE3_APP_ORIGIN || 'http://localhost:3001';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'] });
console.log(`Stage 3 adapter browser: ${browser.version()}; Node ${process.version}`);
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/src/firebase.ts') return route.fulfill({ contentType: 'application/javascript', body: readFileSync(new URL('../tests/fixtures/firebaseAdapter.mjs', import.meta.url), 'utf8') });
    return route.continue();
  });
  await context.addInitScript(origin => {
    if (location.origin !== origin || localStorage.getItem('__stage3_seeded')) return;
    localStorage.setItem('__stage3_seeded', 'true');
    const note = (id, title, content) => ({ id, title, folderId: `folder_${id}`, sections: [{ id: 's', title: 'One', content }], createdAt: 1, updatedAt: 1 });
    for (const uid of ['alice', 'bob']) {
      localStorage.setItem(`uninote_notes_${uid}`, JSON.stringify([note(uid, `${uid} private`, `# ${uid} secret content`)]));
      localStorage.setItem(`uninote_folders_${uid}`, JSON.stringify([{ id: `folder_${uid}`, name: `${uid} folder`, level: 1, parentId: null, createdAt: 1 }]));
    }
    localStorage.setItem('uninote_guest_notes', JSON.stringify([note('guest', 'Guest original', '# Guest original content')]));
    localStorage.setItem('uninote_guest_folders', JSON.stringify([{ id: 'folder_guest', name: 'Guest folder', level: 1, parentId: null, createdAt: 1 }]));
  }, new URL(origin).origin);
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByText('Guest original', { exact: true }).first().waitFor();
  await page.evaluate(() => window.__stage3.emit('alice'));
  await page.getByText('alice folder', { exact: true }).first().click();
  await page.getByText('alice private', { exact: true }).first().click();
  await page.getByTitle('Edit Note', { exact: true }).first().click();
  const raw = page.getByRole('textbox', { name: 'Raw section Markdown', exact: true });
  const latest = '# alice secret content\nLatest edit before token refresh';
  await raw.fill(latest);
  const url = page.url(); const before = await page.evaluate(() => ({ reads: window.__stage3.reads, observations: window.__stage3.observations }));
  await page.evaluate(() => window.__stage3.emit('alice'));
  assert.equal(await raw.inputValue(), latest); assert.equal(page.url(), url);
  assert.deepEqual(await page.evaluate(() => ({ reads: window.__stage3.reads, observations: window.__stage3.observations })), before);
  console.log('PASS: same-account observer callback preserves the open editor, exact buffer and URL without new fetches/subscriptions');
  await page.evaluate(() => window.__stage3.emit(null));
  await page.getByText('Guest original', { exact: true }).first().waitFor();
  assert.ok(!(await page.locator('body').innerText()).includes('alice private'));
  const guest = await page.evaluate(() => localStorage.getItem('uninote_guest_notes'));
  assert.ok(!guest.includes('alice secret')); assert.ok(!guest.includes('Latest edit'));
  assert.ok((await page.evaluate(() => localStorage.getItem('uninote_notes_alice'))).includes('Latest edit'));
  console.log('PASS: logout flushes into the account cache only; no private account note or edit leaks into Guest Mode');
  await page.evaluate(() => window.__stage3.emit('bob'));
  await page.getByText('bob folder', { exact: true }).first().waitFor();
  assert.ok(!(await page.evaluate(() => localStorage.getItem('uninote_notes_bob'))).includes('alice secret'));
  assert.ok(!(await page.evaluate(() => localStorage.getItem('uninote_notes_bob'))).includes('Guest original'));
  console.log('PASS: a second account remains isolated and does not re-claim guest notes already migrated to the first account');
  await page.evaluate(() => { window.__stage3.paused = true; window.__stage3.emit('alice'); });
  await page.waitForFunction(() => window.__stage3.waiting.length > 0);
  await page.evaluate(() => window.__stage3.emit('bob'));
  await page.getByText('bob folder', { exact: true }).first().waitFor();
  await page.evaluate(() => window.__stage3.release());
  await page.waitForFunction(() => window.__stage3.waiting.length === 0);
  await page.getByText('bob folder', { exact: true }).first().click();
  await page.getByText('bob private', { exact: true }).first().click();
  await page.getByTitle('Edit Note', { exact: true }).first().click();
  assert.ok((await raw.inputValue()).includes('bob secret'));
  assert.ok(!(await page.locator('body').innerText()).includes('alice private'));
  console.log('PASS: delayed data from a previous account cannot overwrite the next account view');
  await raw.fill('# bob secret content\nReload boundary edit');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTitle('Edit Note', { exact: true }).first().click();
  assert.equal(await raw.inputValue(), '# bob secret content\nReload boundary edit');
  console.log('PASS: a signed-in cached deep link and latest edit survive reload without guest fallback');
  await page.evaluate(() => { window.__stage3.emit(null); window.__stage3.authError = 'auth/unauthorized-domain'; });
  await page.getByTitle('Sign in with Google', { exact: true }).click();
  const settings = page.getByRole('link', { name: 'Open Firebase authorized domains', exact: true });
  await settings.waitFor(); assert.ok((await settings.getAttribute('href')).endsWith('/test-project/authentication/settings'));
  assert.ok((await page.locator('body').innerText()).includes('localhost'));
  console.log('PASS: unauthorized-domain errors name the current hostname and link directly to Firebase settings');
  assert.deepEqual(errors, []);
  console.log('PASS: zero uncaught page errors; Firebase adapter substituted; no real Google sign-in, uploads or cloud writes performed');
  await context.close();
} finally { await browser.close(); }
