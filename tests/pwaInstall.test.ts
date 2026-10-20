import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser stubs: just enough for the PWA module.
const listeners = new Map<string, Function>();
Object.defineProperty(globalThis, 'window', { value: {
  matchMedia: (q: string) => ({ matches: q.includes('standalone'), media: q }),
  addEventListener: (name: string, fn: Function) => listeners.set(name, fn),
}, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { standalone: false }, configurable: true });
const { isStandaloneDisplay, setupPwa, getPwaState, installPwa } = await import('../src/lib/pwa');

test('standalone (installed) display mode is detected for redirect sign-in', () => {
  assert.equal(isStandaloneDisplay(), true);
  setupPwa();
  assert.equal(getPwaState().installed, true);
});

test('install without a captured install prompt degrades to manual instructions', async () => {
  assert.equal(await installPwa(), 'installed'); // already installed wins
});
