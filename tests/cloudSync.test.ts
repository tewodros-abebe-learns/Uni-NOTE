import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWriteQueue, mergeVersions, authTransitionGuard, timestampMs } from '../src/lib/cloudSync';
import { createAccountSync, type AccountItem } from '../src/lib/accountSync';
import { promoteMediaContent } from '../src/lib/mediaPromotion';
import { authDiagnostic, isAuthorizedHostname } from '../src/lib/authDiagnostics';

function deferred<T = void>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const item = (updatedAt = 1): AccountItem => ({ id: 'note', title: 'Test', sections: [{ id: 's', content: 'original' }], updatedAt });
function harness(disk = new Map<string, string>()) {
  const cloud = new Map<string, AccountItem>();
  const cache: AccountItem[] = [];
  const warnings: (string | null)[] = [];
  let uid = 'alice'; let fail = false; let gate: Promise<void> = Promise.resolve();
  const service = createAccountSync({
    read: key => disk.get(key) || null,
    write: (key, value) => disk.set(key, value),
    assertOwner: owner => { if (owner !== uid) throw new Error('Account changed'); },
    prepare: async (_, __, data) => data,
    commit: async (owner, kind, data) => {
      await gate; if (fail) throw new Error('Offline');
      if (owner !== uid) throw new Error('Account changed');
      const key = `${owner}/${kind}/${data.id}`; const existing = cloud.get(key);
      if (existing && (existing.deletedAt || existing.updatedAt >= data.updatedAt)) return structuredClone(existing);
      cloud.set(key, structuredClone(data)); return data;
    },
    cache: (_, __, data) => { cache.push(data); },
    warn: warning => { warnings.push(warning); }
  });
  return { service, disk, cloud, cache, warnings, setUid: (next: string) => { uid = next; }, setFail: (next: boolean) => { fail = next; }, setGate: (next: Promise<void>) => { gate = next; } };
}

test('per-note lanes serialize rapid writes while different notes/accounts remain independent', async () => {
  const enqueue = createWriteQueue(); const gate = deferred(); const seen: string[] = [];
  const a = enqueue('alice/note', async () => { seen.push('a start'); await gate.promise; seen.push('a end'); });
  const b = enqueue('alice/note', async () => { seen.push('b'); });
  await enqueue('bob/note', async () => { seen.push('bob'); });
  await enqueue('alice/other', async () => { seen.push('other'); });
  assert.deepEqual(seen, ['a start', 'bob', 'other']); gate.resolve(); await Promise.all([a, b]);
  assert.deepEqual(seen.slice(-2), ['a end', 'b']);
});
test('a rejected write does not poison its lane', async () => {
  const enqueue = createWriteQueue(); await assert.rejects(enqueue('n', async () => { throw new Error('Offline'); }));
  assert.equal(await enqueue('n', async () => 'recovered'), 'recovered');
});
test('a caller giving up waiting does not release the underlying write lane', async () => {
  const enqueue = createWriteQueue(); const gate = deferred(); let secondStarted = false;
  const first = enqueue('n', () => gate.promise);
  assert.equal(await Promise.race([first.then(() => 'done'), Promise.resolve('UI timeout')]), 'UI timeout');
  const second = enqueue('n', async () => { secondStarted = true; });
  await Promise.resolve(); assert.equal(secondStarted, false); gate.resolve(); await second; assert.equal(secondStarted, true);
});
test('timestamp merge prefers newer data and cloud ties; tombstones remain terminal', () => {
  assert.equal(mergeVersions([{ id: 'a', updatedAt: 5, title: 'local' }], [{ id: 'a', updatedAt: 5, title: 'cloud' }])[0].title, 'cloud');
  assert.equal(mergeVersions([{ id: 'a', updatedAt: 6 }], [{ id: 'a', updatedAt: 5 }])[0].updatedAt, 6);
  assert.deepEqual(mergeVersions([{ id: 'a', updatedAt: 100 }], [{ id: 'a', updatedAt: 1, deletedAt: 1 }]), []);
  assert.deepEqual(mergeVersions([{ id: 'a', updatedAt: 1, deletedAt: 1 }], [{ id: 'a', updatedAt: 200 }]), []);
  assert.equal(timestampMs({ seconds: 2, nanoseconds: 500000000 }), 2500);
});
test('same-UID auth callbacks do not invalidate navigation; account switches invalidate async work', () => {
  const guard = authTransitionGuard(); const alice = guard.change('alice')!;
  assert.equal(guard.change('alice'), null); assert.equal(alice(), true);
  const bob = guard.change('bob')!; assert.equal(alice(), false); assert.equal(bob(), true);
  guard.change(null); assert.equal(bob(), false); guard.invalidate();
});
test('offline writes remain in the durable per-user outbox and replay successfully', async () => {
  const h = harness(); h.setFail(true); h.service.stage('alice', 'notes', item());
  await assert.rejects(h.service.commit('alice', 'notes', item()));
  assert.equal(JSON.parse(h.disk.get('uninote_outbox_alice')!).length, 1); assert.equal(h.cloud.size, 0);
  h.setFail(false); await h.service.retry('alice');
  assert.equal(JSON.parse(h.disk.get('uninote_outbox_alice')!).length, 0); assert.equal(h.cloud.size, 1); assert.equal(h.warnings.at(-1), null);
});
test('late acknowledgement cannot erase a newer staged edit or its local cache', async () => {
  const h = harness(); const gate = deferred(); h.setGate(gate.promise);
  h.service.stage('alice', 'notes', item(1)); const first = h.service.commit('alice', 'notes', item(1));
  await Promise.resolve(); const newer = item(2); newer.title = 'Newer'; h.service.stage('alice', 'notes', newer);
  gate.resolve(); await first;
  assert.equal(JSON.parse(h.disk.get('uninote_outbox_alice')!)[0].data.title, 'Newer'); assert.equal(h.cache.length, 0);
  await h.service.retry('alice'); assert.equal(h.cloud.get('alice/notes/note')!.title, 'Newer');
});
test('queued payload is immutable even if the caller mutates its object', async () => {
  const h = harness(); const original = item(); h.service.stage('alice', 'notes', original);
  const promise = h.service.commit('alice', 'notes', original); original.title = 'mutated'; await promise;
  assert.equal(h.cloud.get('alice/notes/note')!.title, 'Test');
});
test('cloud tombstone suppresses even a newer pending edit and archives it without resurrection', async () => {
  const h = harness(); const tombstone = { ...item(2), deletedAt: 2 }; h.cloud.set('alice/notes/note', tombstone);
  h.service.stage('alice', 'notes', item(3));
  assert.deepEqual(h.service.merge('alice', 'notes', [item(3)], [tombstone]), []);
  await h.service.retry('alice'); assert.equal(h.cloud.get('alice/notes/note')!.deletedAt, 2);
  assert.equal(JSON.parse(h.disk.get('uninote_conflicts_alice')!)[0].original.updatedAt, 3);
});
test('cloud conflict on equal timestamp keeps server data and archives the attempted edit', async () => {
  const h = harness(); h.cloud.set('alice/notes/note', { ...item(5), title: 'Cloud choice' });
  h.service.stage('alice', 'notes', item(5)); await h.service.retry('alice');
  assert.equal(h.cache.at(-1)!.title, 'Cloud choice'); assert.ok(h.disk.has('uninote_conflicts_alice'));
});
test('account switch prevents queued cloud writes and never publishes the old failure into the new account', async () => {
  const h = harness(); h.service.stage('alice', 'notes', item());
  const before = h.warnings.length; h.setUid('bob'); await assert.rejects(h.service.commit('alice', 'notes', item()));
  assert.equal(h.warnings.length, before); assert.equal(h.cloud.size, 0); assert.equal(JSON.parse(h.disk.get('uninote_outbox_alice')!).length, 1);
  assert.deepEqual(h.service.merge('bob', 'notes', [], []), []);
});
test('cloud promotion replaces complete tokens only, deduplicates and preserves surrounding markup', async () => {
  const seen: string[] = []; const input = 'Before\n![a](media_x.png) @@left:small@@\n![b](media_x.png)\n![c](media_x.png.more)\nAfter $E=mc^2$';
  const output = await promoteMediaContent(input, async id => { seen.push(id); return `https://example.com/${id}`; });
  assert.equal(seen.length, 2); assert.equal(output, input.replace(/media_x.png.more/g, 'https://example.com/media_x.png.more').replace(/(?<!example.com\/)media_x.png(?!\.more)/g, 'https://example.com/media_x.png'));
});
test('failed or insecure media promotion rejects instead of publishing broken references', async () => {
  await assert.rejects(promoteMediaContent('![a](media_a.png)', async () => { throw new Error('Storage denied'); }));
  await assert.rejects(promoteMediaContent('![a](media_a.png)', async () => 'http://unsafe.example/a.png'));
});
test('authorized-domain diagnosis uses exact hostnames, including preview domains', () => {
  assert.equal(isAuthorizedHostname('preview.vercel.app', ['vercel.app']), false);
  assert.equal(isAuthorizedHostname('preview.vercel.app', ['preview.vercel.app']), true);
  const diagnostic = authDiagnostic('123-sandbox.e2b.app', 'my-project');
  assert.ok(diagnostic.message.includes('123-sandbox.e2b.app')); assert.ok(diagnostic.authSettingsUrl.includes('/my-project/authentication/settings'));
});

test('already promoted Firebase URLs are never promoted again or nested inside themselves', async () => {
  const content = '![a](https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Falice%2Fimages%2Fmedia_hash.png?alt=media&token=abc)\n![b](https://example.com/media_hash.png)\n![c](https://example.com/?image=media_hash.png)';
  let uploads = 0;
  assert.equal(await promoteMediaContent(content, async () => { uploads++; return 'https://example.com/new'; }), content);
  assert.equal(uploads, 0);
});

test('pending writes replay after constructing a fresh sync service from persisted storage', async () => {
  const first = harness(); first.service.stage('alice', 'notes', item(7));
  const restarted = harness(first.disk); await restarted.service.retry('alice');
  assert.equal(restarted.cloud.get('alice/notes/note')!.updatedAt, 7);
  assert.equal(JSON.parse(restarted.disk.get('uninote_outbox_alice')!).length, 0);
});
test('a strictly newer cloud snapshot wins while the attempted local content remains recoverable', async () => {
  const h = harness(); h.cloud.set('alice/notes/note', { ...item(10), title: 'Newer cloud' });
  h.service.stage('alice', 'notes', item(2)); await h.service.retry('alice');
  assert.equal(h.cache.at(-1)!.title, 'Newer cloud');
  assert.equal(JSON.parse(h.disk.get('uninote_conflicts_alice')!)[0].original.title, 'Test');
});
test('corrupt outbox data is rejected without overwriting its recovery source', async () => {
  const h = harness(); h.disk.set('uninote_outbox_alice', '{broken');
  assert.throws(() => h.service.stage('alice', 'notes', item()));
  await assert.rejects(h.service.retry('alice'));
  assert.equal(h.disk.get('uninote_outbox_alice'), '{broken');
});
