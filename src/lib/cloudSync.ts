/** A timeout must never release a write lane: the underlying operation may still commit. */
export function createWriteQueue() {
  const lanes = new Map<string, Promise<unknown>>();
  return function enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = lanes.get(key) || Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    lanes.set(key, next);
    void next.finally(() => { if (lanes.get(key) === next) lanes.delete(key); }).catch(() => undefined);
    return next;
  };
}
export const enqueueNoteWrite = createWriteQueue();
export function timestampMs(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (value instanceof Date) return value.getTime();
  return Date.parse(value) || 0;
}
export interface Versioned { id: string; updatedAt?: any; createdAt?: any; deletedAt?: number }
export const version = (item: Versioned) => timestampMs(item.updatedAt || item.createdAt);
/** Cloud wins timestamp ties; tombstones are never overridden by stale cached data. */
export function mergeVersions<T extends Versioned>(local: T[], cloud: T[]): T[] {
  const map = new Map(local.map(item => [item.id, item]));
  for (const item of cloud) {
    const cached = map.get(item.id);
    if (cached?.deletedAt && !item.deletedAt) continue;
    if (!cached || version(item) >= version(cached) || item.deletedAt) map.set(item.id, item);
  }
  return [...map.values()].filter(item => !item.deletedAt);
}
export function authTransitionGuard() {
  let uid: string | null | undefined;
  let epoch = 0;
  return {
    change(next: string | null) {
      if (uid === next) return null;
      uid = next;
      const captured = ++epoch;
      return () => captured === epoch;
    },
    invalidate() { epoch++; uid = undefined; }
  };
}
