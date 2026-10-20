import { createWriteQueue, mergeVersions, version, type Versioned } from './cloudSync';
export type AccountKind = 'notes' | 'folders';
export type AccountItem = Versioned & Record<string, any>;
interface PendingWrite { kind: AccountKind; data: AccountItem }
interface Dependencies {
  read(key: string): string | null;
  write(key: string, value: string): unknown;
  assertOwner(uid: string): void;
  prepare(uid: string, kind: AccountKind, data: AccountItem): Promise<AccountItem>;
  commit(uid: string, kind: AccountKind, data: AccountItem): Promise<AccountItem>;
  cache(uid: string, kind: AccountKind, data: AccountItem): void;
  warn(message: string | null): void;
}
/** Durable staging is separate from acknowledgement, so failed/time-limited writes remain replayable. */
export function createAccountSync(deps: Dependencies) {
  const enqueue = createWriteQueue();
  const warn = (uid: string, message: string | null) => {
    try { deps.assertOwner(uid); } catch { return; }
    deps.warn(message);
  };
  const canonical = (value: any): string => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  const key = (uid: string) => `uninote_outbox_${uid}`;
  const pending = (uid: string): PendingWrite[] => {
    const raw = deps.read(key(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Invalid outbox. Export local data before attempting recovery.');
    return parsed;
  };
  function stage(uid: string, kind: AccountKind, data: AccountItem) {
    deps.assertOwner(uid);
    const entries = pending(uid).filter(p => p.kind !== kind || p.data.id !== data.id);
    deps.write(key(uid), JSON.stringify([...entries, { kind, data }]));
    // Deliberately NO warning here: staging is the normal first step of every
    // save, and warning at this point cried wolf on every keystroke-edit
    // even when the commit confirmed a second later. The commit path warns
    // only on actual failure, and clears the warning once nothing is pending.
  }
  function commit(uid: string, kind: AccountKind, original: AccountItem) {
    // Clone at submission, not when a queued task eventually starts.
    const snapshot = structuredClone(original);
    return enqueue(`${uid}/${kind}/${snapshot.id}`, async () => {
      deps.assertOwner(uid);
      const data = await deps.prepare(uid, kind, structuredClone(snapshot));
      deps.assertOwner(uid);
      const result = await deps.commit(uid, kind, data);
      const conflict = Boolean(result.deletedAt && !snapshot.deletedAt || version(result) > version(snapshot) || version(result) === version(snapshot) && canonical(result) !== canonical(data));
      if (conflict) {
        const conflictKey = `uninote_conflicts_${uid}`;
        const previous = JSON.parse(deps.read(conflictKey) || '[]');
        if (!previous.some((p: any) => p.kind === kind && JSON.stringify(p.original) === JSON.stringify(snapshot))) {
          deps.write(conflictKey, JSON.stringify([...previous, { kind, original: snapshot, cloud: result, recordedAt: Date.now() }]));
        }
      }
      // A late acknowledgement must never clear a more recent pending edit.
      const entries = pending(uid);
      const own = entries.find(p => p.kind === kind && p.data.id === snapshot.id);
      if (own && JSON.stringify(own.data) === JSON.stringify(snapshot)) {
        deps.write(key(uid), JSON.stringify(entries.filter(p => p !== own)));
        deps.cache(uid, kind, result);
      }
      if (conflict) warn(uid, 'A newer cloud version or deletion was kept. Download the conflict backup to recover your attempted edit.');
      else if (!pending(uid).length && !deps.read(`uninote_conflicts_${uid}`)) warn(uid, null);
      return result;
    }).catch(error => {
      warn(uid, 'Cloud sync is pending or failed. Local data and image Blobs are retained. Check connectivity and Firebase rules, then Retry cloud sync.');
      throw error;
    });
  }
  return {
    stage, commit,
    hasPending: (uid: string, kind: AccountKind, id: string) => pending(uid).some(p => p.kind === kind && p.data.id === id),
    async retry(uid: string) {
      deps.assertOwner(uid);
      await Promise.all(pending(uid).map(p => commit(uid, p.kind, p.data)));
      if (!pending(uid).length && !deps.read(`uninote_conflicts_${uid}`)) warn(uid, null);
    },
    merge<T extends AccountItem>(uid: string, kind: AccountKind, local: T[], cloud: T[]): T[] {
      return mergeVersions(local, [...pending(uid).filter(p => p.kind === kind).map(p => p.data as T), ...cloud]);
    },
  };
}
