// Match lightweight source references, never media_* embedded inside an HTTPS URL.
const referencePattern = () => /(^|[\s(])(media_[a-zA-Z0-9._-]+)(?=[\s)"']|$)/gm;
export const getMediaReferences = (content: string) => [...new Set([...content.matchAll(referencePattern())].map(match => match[2]))];
/** Pure orchestration: no local source or Blob is deleted, even after upload. */
export async function promoteMediaContent(content: string, upload: (id: string) => Promise<string>): Promise<string> {
  const urls = new Map<string, string>();
  for (const id of getMediaReferences(content)) {
    const url = await upload(id);
    if (!url) continue;
    if (url !== id && !/^https:\/\//.test(url)) throw new Error('Cloud image upload did not return an HTTPS URL');
    urls.set(id, url);
  }
  return content.replace(referencePattern(), (_, prefix, id) => {
    const target = urls.get(id);
    return target ? prefix + target : prefix + id;
  });
}
