// Production smoke check. Start `NODE_ENV=production npm start` first.
// Supply an installed Chromium executable via BROWSER_EXECUTABLE_PATH.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || 'chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'],
});
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
const errors = [];
console.log(`Browser: ${browser.version()}; Node: ${process.version}`);
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  // Isolate external services: do not authenticate, upload, or mutate live data.
  // Serve the matching installed KaTeX resources instead of relying on CDN access.
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (new URL(url).origin === new URL(origin).origin) return route.continue();
    if (url.includes('/katex@')) {
      const relative = url.split('/dist/')[1];
      if (['katex.min.js', 'contrib/auto-render.min.js', 'katex.min.css'].includes(relative)) {
        return route.fulfill({
          contentType: relative.endsWith('.css') ? 'text/css' : 'application/javascript',
          body: readFileSync(new URL(`../node_modules/katex/dist/${relative}`, import.meta.url)),
        });
      }
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByText('Quantum Physics', { exact: true }).first().waitFor();
  console.log('PASS: production app opens in guest mode');

  for (const theme of ['midnight', 'sunset', 'forest', 'royal', 'paper']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const palette = await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.innerHTML = '<div class="bg-bg text-text border border-accent">Main</div><div class="bg-surface">Surface</div><button class="bg-accent text-on-accent">Action</button>';
      document.body.append(fixture);
      const result = [...fixture.children].map(element => {
        const css = getComputedStyle(element);
        return { bg: css.backgroundColor, text: css.color, border: css.borderColor };
      });
      const vars = getComputedStyle(document.documentElement);
      result.push({ bg: vars.getPropertyValue('--bg-main').trim(), surface: vars.getPropertyValue('--bg-surface').trim(), accent: vars.getPropertyValue('--accent').trim() });
      fixture.remove();
      return result;
    });
    const rgb = hex => {
      const full = hex.length === 4 ? hex.slice(1).split('').map(v => v + v).join('') : hex.slice(1);
      return `rgb(${full.match(/../g).map(v => parseInt(v, 16)).join(', ')})`;
    };
    assert.equal(palette[0].bg, rgb(palette[3].bg));
    assert.equal(palette[1].bg, rgb(palette[3].surface));
    assert.equal(palette[2].bg, rgb(palette[3].accent));
    assert.equal(palette[0].border, rgb(palette[3].accent));
    assert.notEqual(palette[2].bg, palette[2].text);
    if (process.env.BROWSER_SCREENSHOT_DIR) {
      mkdirSync(process.env.BROWSER_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.BROWSER_SCREENSHOT_DIR, `${theme}.png`), fullPage: true });
    }
    console.log(`PASS: ${theme} compiled background, surface, text, border, accent and button tokens`);
  }
  await page.getByRole('button', { name: 'Open Account & Settings' }).click();
  for (const name of ['Midnight', 'Sunset', 'Forest', 'Royal', 'Paper']) {
    await page.getByTitle('Choose Theme').click();
    await page.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), name.toLowerCase());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aetheria_settings')).theme), name.toLowerCase());
  }
  await page.getByTitle('Close panel').click();
  console.log('PASS: all five theme choices apply through the UI and persist preferences');
  await page.getByText('Schrödinger Equation & Wave Mechanics', { exact: true }).first().click();
  await page.locator('.note-content-container').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.katex').length > 0);
  assert.ok(await page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]').count());
  assert.ok(await page.locator('.media-adjust-trigger').count());
  console.log('PASS: demo note opens with rendered KaTeX, allowed YouTube iframe and gear controls');

  // Persist a hostile import-like fixture in this disposable browser context only.
  await page.evaluate(() => {
    const key = 'uninote_guest_notes';
    const notes = JSON.parse(localStorage.getItem(key) || '[]');
    notes.unshift({ id: 'stage1_xss_fixture', folderId: 'demo_folder_physics', title: 'Stage 1 XSS Fixture', createdAt: Date.now(), sections: [{ id: 'one', title: 'Security', content: '# Safe Heading\n\n<img src=x onerror="window.__xss=1">\n\n<script>window.__xss=2</script>\n\n![diagram](/icon.svg) @@right-small@@\n\n[youtube](https://youtu.be/kYAdwS5MFjQ)\n\n$E=mc^2$' }] });
    localStorage.setItem(key, JSON.stringify(notes));
  });
  await page.goto(`${origin}/?noteId=stage1_xss_fixture`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Safe Heading', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('.note-content-container [onerror], .note-content-container script').count(), 0);
  assert.ok(await page.locator('.image-embed-wrapper[data-align="right"][data-size="small"] img').count());
  console.log('PASS: hostile note does not execute; image layout survives sanitization');
  assert.deepEqual(errors, []);
  console.log('PASS: zero uncaught browser errors (external services intentionally isolated)');
  await context.close();
} finally {
  await browser.close();
}
