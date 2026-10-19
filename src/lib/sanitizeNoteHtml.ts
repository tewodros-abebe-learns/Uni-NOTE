import { isLocalMediaObjectUrl } from '../utils/mediaStore';
import DOMPurify from 'dompurify';

// Keep a narrow note vocabulary. Scripts, forms, base, objects, arbitrary SVG,
// srcdoc, event handlers and CSS are never accepted from note content.
const tags = [
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
  'ul', 'ol', 'li', 'pre', 'code', 'strong', 'b', 'em', 'i', 'del', 's',
  'u', 'mark', 'sub', 'sup', 'a', 'img', 'div', 'span', 'table', 'thead',
  'tbody', 'tfoot', 'tr', 'th', 'td', 'iframe', 'button', 'svg', 'path', 'circle',
];
const attributes = [
  'style', 'class', 'title', 'href', 'src', 'alt', 'width', 'height', 'loading',
  'colspan', 'rowspan', 'start', 'type', 'aria-label',
  'data-video-id', 'data-raw-url', 'data-media-type', 'data-align', 'data-size',
  'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'xmlns', 'allowfullscreen',
];

const isSafeUrl = (value: string, image = false): boolean => {
  if (/^[\u0000-\u0020]|[\u0000-\u001f\u007f]/.test(value)) return false;
  if (image && isLocalMediaObjectUrl(value)) return true;
  if (image && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) return true;
  // Relative paths, local media IDs, fragments, and explicit web links only.
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return /^https?:\/\//i.test(value);
  return !value.startsWith('//') && !value.includes('\\');
};

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  // Preserve the editor's highlight colors, never arbitrary note CSS.
  if (data.attrName === 'style') {
    const highlight = node.nodeName === 'MARK' && data.attrValue.match(
      /^background-color:\s*(#[a-f\d]{6});\s*color:\s*black;\s*border-radius:\s*2px;\s*padding:\s*0 4px;?$/i,
    );
    data.keepAttr = Boolean(highlight);
    if (highlight) data.attrValue = `background-color: ${highlight[1]}; color: black; border-radius: 2px; padding: 0 4px;`;
  }
  if (['fill', 'stroke'].includes(data.attrName)) {
    data.keepAttr = /^(none|currentColor|#[a-f\d]{3,8})$/i.test(data.attrValue);
  }
  if (['src', 'href', 'data-raw-url'].includes(data.attrName)) {
    data.keepAttr = isSafeUrl(data.attrValue, true);
  }
  if (data.attrName === 'data-align') data.keepAttr = /^(left|center|right)$/.test(data.attrValue);
  if (data.attrName === 'data-size') data.keepAttr = /^(small|medium|large|full)$/.test(data.attrValue);
  if (data.attrName === 'data-video-id') data.keepAttr = /^[\w-]{11}$/.test(data.attrValue);
  if (data.attrName === 'data-media-type') data.keepAttr = /^(image|video)$/.test(data.attrValue);
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName !== 'IFRAME') return;
  const frame = node as HTMLIFrameElement;
  // Absolute, exact host, exact embed path, numeric start only. No alternate
  // hosts, credentials, ports, srcdoc, arbitrary query parameters or fragments.
  const src = frame.getAttribute('src') || '';
  if (!/^https:\/\/www\.youtube-nocookie\.com\/embed\/[a-zA-Z0-9_-]{11}(?:\?start=\d+)?$/.test(src)) {
    frame.remove();
    return;
  }
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  frame.setAttribute('loading', 'lazy');
  frame.removeAttribute('allowfullscreen');
  frame.setAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen');
});

export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: tags,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    ALLOWED_ATTR: attributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'base', 'form', 'input', 'object', 'embed', 'link', 'meta'],
    FORBID_ATTR: ['srcdoc', 'action', 'formaction', 'id', 'name'],
    SANITIZE_NAMED_PROPS: true,
  });
}
