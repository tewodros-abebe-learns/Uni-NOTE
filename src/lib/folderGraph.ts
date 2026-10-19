export interface FolderNode { id: string; parentId: string | null }

/** All traversals terminate even when imported/legacy data already has cycles. */
export function getFolderAncestors<T extends FolderNode>(folders: T[], id: string): T[] {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const visited = new Set<string>();
  const path: T[] = [];
  let current = byId.get(id);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function collectFolderIds(folders: FolderNode[], id: string): Set<string> {
  const visited = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const next = pending.pop()!;
    if (visited.has(next)) continue;
    visited.add(next);
    for (const folder of folders) if (folder.parentId === next) pending.push(folder.id);
  }
  return visited;
}

export function canMoveFolder(folders: FolderNode[], id: string, parentId: string | null): boolean {
  if (!folders.some(folder => folder.id === id)) return false;
  if (parentId === null) return true; // Also allows repairing legacy cycles.
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const visited = new Set([id]);
  let current: string | null = parentId;
  while (current !== null) {
    if (visited.has(current)) return false;
    visited.add(current);
    const folder = byId.get(current);
    if (!folder) return false;
    current = folder.parentId;
  }
  return true;
}
