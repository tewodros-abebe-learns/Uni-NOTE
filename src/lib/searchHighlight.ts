/** Text-node highlighting: never interpolate a query as HTML or damage math/media nodes. */
export function highlightSearch(container: HTMLElement, query: string, activeIndex = 0): number {
  for (const mark of container.querySelectorAll('mark.search-match')) mark.replaceWith(document.createTextNode(mark.textContent || ''));
  container.normalize();
  const q = query.trim().toLowerCase(); if (!q) return 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT); const nodes: Text[] = [];
  while (walker.nextNode()) { const node = walker.currentNode as Text; if (!node.parentElement?.closest('.katex, button, script, style')) nodes.push(node); }
  let count = 0;
  for (const node of nodes) {
    const text = node.data; const lower = text.toLowerCase(); let start = 0; let pos = lower.indexOf(q); if (pos < 0) continue;
    const fragment = document.createDocumentFragment();
    while (pos >= 0) {
      fragment.append(document.createTextNode(text.slice(start, pos))); const mark = document.createElement('mark');
      mark.className = `search-match${count++ === activeIndex ? ' search-match-active' : ''}`; mark.textContent = text.slice(pos, pos + q.length); fragment.append(mark);
      start = pos + q.length; pos = lower.indexOf(q, start);
    }
    fragment.append(document.createTextNode(text.slice(start))); node.replaceWith(fragment);
  }
  container.querySelector('.search-match-active')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  return count;
}
