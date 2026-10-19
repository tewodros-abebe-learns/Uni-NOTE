/** Non-destructive recovery for failed browser-storage writes. Never evicts data. */
const pendingWrites = new Map<string, string>();
let warning: string | null = null;
const listeners = new Set<() => void>();
export const getStorageWarning = () => warning;
export const subscribeStorageWarnings = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function reportStorageFailure(message = 'Browser storage is unavailable or full. Latest changes remain in this tab only. Export a backup before closing or reloading.') {
  warning = message;
  listeners.forEach(listener => listener());
}
export function readLocalValue(key: string): string | null {
  if (pendingWrites.has(key)) return pendingWrites.get(key)!;
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writeLocalValue(key: string, value: string): boolean {
  // Keep the complete failed value in memory, while leaving the old disk copy intact.
  try {
    localStorage.setItem(key, value);
    const recovered = pendingWrites.delete(key);
    if (recovered && !pendingWrites.size && warning) {
      warning = null;
      listeners.forEach(listener => listener());
    }
    return true;
  } catch {
    pendingWrites.set(key, value);
    reportStorageFailure();
    return false;
  }
}
export function retryPendingWrites(): boolean {
  for (const [key, value] of pendingWrites) writeLocalValue(key, value);
  return pendingWrites.size === 0;
}

/** Include memory-only keys so quota failures cannot bypass account isolation. */
export function listLocalKeys(): string[] {
  const keys = new Set(pendingWrites.keys());
  try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key) keys.add(key); } } catch { /* Memory-only recovery remains available. */ }
  return [...keys];
}

export const hasPendingLocalWrites = () => pendingWrites.size > 0;
