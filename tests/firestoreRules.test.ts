import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('firestore rules: everything is owner-only with a default deny', () => {
  assert.match(rules, /match \/{path=\*\*}\s*\{\s*allow read, write: if false;/, 'default deny present');
  for (const collection of ['folders', 'notes', 'media']) {
    const block = rules.match(new RegExp(`match /${collection}/\\{[^}]+\\} \\{([\\s\\S]*?)\\n      \\}`))?.[1] || '';
    assert.ok(block.length > 0, `${collection} match block exists`);
    assert.match(block, /isOwner\(userId\)/, `${collection} requires ownership`);
    assert.doesNotMatch(block, /allow (read|write|create|update|delete)[^;]*if true/, `${collection} has no public grant`);
  }
  assert.doesNotMatch(rules, /allow read, write: if (?!false)/, 'no broad read/write grant anywhere');
});

test('firestore rules: media documents are validated and size-capped', () => {
  assert.match(rules, /request\.resource\.data\.id == mediaId/);
  assert.match(rules, /25 \* 1024 \* 1024/, 'media size capped at 25 MB');
  assert.match(rules, /matches\('image\/\.\*'\)/, 'media type restricted to images');
});

test('firestore rules: notes and folders validate identity and shape', () => {
  assert.match(rules, /data\.id == noteId/);
  assert.match(rules, /data\.id == folderId/);
  assert.match(rules, /hasOnly\(\['id', 'folderId', 'title', 'sections'/, 'note fields restricted');
});
