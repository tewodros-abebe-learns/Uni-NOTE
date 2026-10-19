import { renderContent } from './renderContent';
import { renderNoteMath } from './math';
import type { VaultBackup } from './vaultBackup';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function backupHtml(backup: VaultBackup): string {
  if (Object.values(backup.media).some(url => !/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(url))) throw new Error('For SVG/AVIF or other non-raster archives, choose JSON or Markdown to preserve every image. HTML supports PNG, JPEG, GIF and WebP.');
  const container = document.createElement('main');
  container.innerHTML = backup.notes.map(note => `<article><h1>${escape(note.title)}</h1>` + note.sections.map(section => {
    const content = section.content.replace(/(^|[\s(])(media_[a-zA-Z0-9._-]+)(?=[\s)"']|$)/gm, (_, prefix, id) => prefix + (backup.media[id] || id));
    return `<section><h2>${escape(section.title)}</h2>${renderContent(content)}</section>`;
  }).join('') + '</article>').join('');
  container.querySelectorAll('.media-adjust-trigger').forEach(button => button.remove());
  renderNoteMath(container, 'mathml');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; frame-src https://www.youtube-nocookie.com; style-src 'unsafe-inline'"><title>Uni.Note export</title><style>body{font:18px/1.7 system-ui,sans-serif;margin:2rem auto;padding:1rem;max-width:960px;color:#18202c}img{max-width:100%;height:auto}.media-embed-wrapper{max-width:100%;margin-top:1rem;margin-bottom:1rem}.media-embed-wrapper[data-align=left]{margin-left:0;margin-right:auto}.media-embed-wrapper[data-align=center]{margin-left:auto;margin-right:auto}.media-embed-wrapper[data-align=right]{margin-left:auto;margin-right:0}.media-embed-wrapper[data-size=small]{width:35%;min-width:min(280px,100%)}.media-embed-wrapper[data-size=medium]{width:65%;min-width:min(340px,100%)}.media-embed-wrapper[data-size=large]{width:85%;min-width:min(400px,100%)}.media-embed-wrapper[data-size=full]{width:100%}.youtube-embed-wrapper{aspect-ratio:16/9;position:relative}.youtube-embed-wrapper iframe{position:absolute;inset:0}iframe{width:100%;height:100%;border:0}pre{overflow:auto;background:#eee;padding:1rem}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.4rem}article+article{border-top:2px solid #aaa;margin-top:3rem}math[display=block]{display:block;text-align:center;margin:1rem 0}</style></head><body>${container.outerHTML}</body></html>`;
}
