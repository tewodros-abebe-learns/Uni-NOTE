import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, normalizeTheme } from '../src/lib/themes';
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
function luminance(hex: string) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi)!.map(x => {
    const value = parseInt(x, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
test('Tailwind inline tokens map to live CSS variables', () => {
  const tokens = css.match(/@theme inline\s*\{([^}]+)\}/)![1];
  for (const name of ['bg', 'main', 'surface', 'hover', 'text', 'muted', 'dim', 'subtle', 'accent', 'on-accent']) {
    assert.match(tokens, new RegExp(`--color-${name}: var\\(--[\\w-]+\\)`));
  }
});
for (const theme of THEMES) test(`${theme.name}: complete palette and accessible primary contrast`, () => {
  const block = css.match(new RegExp(`\\[data-theme="${theme.id}"\\] \\{([^}]+)\\}`))![1];
  const vars = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(m => [m[1], m[2]]));
  for (const key of ['bg-main', 'bg-surface', 'bg-hover', 'text-main', 'text-muted', 'text-dim', 'accent', 'on-accent']) assert.ok(vars[key], key);
  assert.ok(contrast(vars['bg-main'], vars['text-main']) >= 7, 'primary text contrast');
  assert.ok(contrast(vars['bg-surface'], vars['text-main']) >= 7, 'surface text contrast');
  assert.ok(contrast(vars.accent, vars['on-accent']) >= 4.5, 'accent button contrast');
});
test('legacy theme preferences migrate to light/dark/full-dark and invalid values use a safe default', () => {
  assert.equal(normalizeTheme('obsidian'), 'black');
  assert.equal(normalizeTheme('nord'), 'dark');
  assert.equal(normalizeTheme('midnight'), 'dark');
  assert.equal(normalizeTheme('royal'), 'dark');
  assert.equal(normalizeTheme('sepia'), 'light');
  assert.equal(normalizeTheme('alabaster'), 'light');
  assert.equal(normalizeTheme('paper'), 'light');
  assert.equal(normalizeTheme('bad'), 'dark');
  assert.equal(normalizeTheme(null), 'dark');
});
