import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMoveFolder, collectFolderIds, getFolderAncestors } from '../src/lib/folderGraph';
const folders = [
  { id: 'root', parentId: null }, { id: 'child', parentId: 'root' },
  { id: 'grandchild', parentId: 'child' }, { id: 'other', parentId: null },
];
test('folder moves reject self, descendants and missing nodes', () => {
  assert.equal(canMoveFolder(folders, 'root', 'root'), false);
  assert.equal(canMoveFolder(folders, 'root', 'grandchild'), false);
  assert.equal(canMoveFolder(folders, 'root', 'missing'), false);
  assert.equal(canMoveFolder(folders, 'missing', null), false);
});
test('valid moves and root moves remain available', () => {
  assert.equal(canMoveFolder(folders, 'child', 'other'), true);
  assert.equal(canMoveFolder(folders, 'grandchild', 'root'), true);
  assert.equal(canMoveFolder(folders, 'child', null), true);
});
test('breadcrumbs and subtree IDs preserve valid hierarchies', () => {
  assert.deepEqual(getFolderAncestors(folders, 'grandchild').map(f => f.id), ['root', 'child', 'grandchild']);
  assert.deepEqual([...collectFolderIds(folders, 'root')].sort(), ['child', 'grandchild', 'root']);
});
test('legacy cycles terminate in navigation/deletion and cannot become move destinations', () => {
  const corrupt = [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: null }];
  assert.equal(getFolderAncestors(corrupt, 'a').length, 2);
  assert.equal(collectFolderIds(corrupt, 'a').size, 2);
  assert.equal(canMoveFolder(corrupt, 'c', 'a'), false);
  assert.equal(canMoveFolder(corrupt, 'a', null), true);
});
test('deep trees are traversed without recursion overflow', () => {
  const deep = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), parentId: i ? String(i - 1) : null }));
  assert.equal(getFolderAncestors(deep, '999').length, 1000);
  assert.equal(collectFolderIds(deep, '0').size, 1000);
});
