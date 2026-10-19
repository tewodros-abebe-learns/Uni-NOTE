import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import katex from 'katex';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://uninote.test' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
const { renderContent } = await import('../src/lib/renderContent');
const { sanitizeNoteHtml } = await import('../src/lib/sanitizeNoteHtml');
const parse = (html: string) => new JSDOM(html).window.document;

const attacks: [string, string][] = [
  ['script', '<script>alert(1)</script>'],
  ['image event', '<img src=x onerror="alert(1)">'],
  ['SVG event', '<svg onload="alert(1)"><circle onmouseover="alert(1)" /></svg>'],
  ['javascript link', '<a href="javascript:alert(1)">click</a>'],
  ['encoded link', '<a href="jav&#x61;script:alert(1)">click</a>'],
  ['control character link', '<a href="java&#10;script:alert(1)">click</a>'],
  ['data document', '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>'],
  ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>" src="https://evil.test"></iframe>'],
  ['host suffix', '<iframe src="https://www.youtube-nocookie.com.evil.test/embed/kYAdwS5MFjQ"></iframe>'],
  ['host credentials', '<iframe src="https://www.youtube-nocookie.com@evil.test/embed/kYAdwS5MFjQ"></iframe>'],
  ['YouTube non-embed', '<iframe src="https://www.youtube-nocookie.com/redirect?q=evil"></iframe>'],
  ['YouTube HTTP', '<iframe src="http://www.youtube-nocookie.com/embed/kYAdwS5MFjQ"></iframe>'],
  ['YouTube query', '<iframe src="https://www.youtube-nocookie.com/embed/kYAdwS5MFjQ?evil=1"></iframe>'],
  ['YouTube fragment', '<iframe src="https://www.youtube-nocookie.com/embed/kYAdwS5MFjQ#evil"></iframe>'],
  ['YouTube port', '<iframe src="https://www.youtube-nocookie.com:444/embed/kYAdwS5MFjQ"></iframe>'],
  ['base injection', '<base href="https://evil.test/" target="_top">'],
  ['form hijack', '<form action="https://evil.test"><input name="password"><button formaction="https://evil.test">go</button></form>'],
  ['object embed', '<object data="https://evil.test"><embed src="https://evil.test"></object>'],
  ['meta redirect', '<meta http-equiv="refresh" content="0;url=https://evil.test">'],
  ['CSS URL', '<div style="background:url(javascript:alert(1))">x</div>'],
  ['SVG foreignObject', '<svg><foreignObject><iframe src="https://evil.test"></iframe></foreignObject></svg>'],
  ['SVG xlink', '<svg><a xlink:href="javascript:alert(1)">click</a></svg>'],
  ['DOM clobbering', '<a id="location" name="document" href="#">x</a>'],
  ['mutation XSS', '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">'],
  ['SVG data image', '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">'],
  ['Markdown link', '[click](javascript:alert%281%29)'],
  ['Markdown image attribute breakout', '![" onerror="alert(1)](https://example.test/a.png)'],
  ['Markdown image URL breakout', '![x](https://example.test/" onerror="alert(1))'],
  ['math placeholder injection', '$<img src=x onerror=alert(1)>$'],
];

for (const [name, input] of attacks) {
  test(`XSS neutralized: ${name}`, () => {
    const doc = parse(renderContent(input));
    assert.equal(doc.querySelector('script,style,base,form,input,object,embed,meta,foreignObject,math'), null);
    for (const element of doc.querySelectorAll('*')) {
      for (const attr of element.attributes) {
        assert.ok(!/^on/i.test(attr.name), `${name}: ${attr.name}`);
        assert.ok(!['srcdoc', 'action', 'formaction', 'style', 'id', 'name'].includes(attr.name));
        if (['href', 'src'].includes(attr.name)) assert.ok(!/^(javascript|vbscript|data:text|data:image\/svg)/i.test(attr.value));
      }
    }
    for (const iframe of doc.querySelectorAll('iframe')) {
      assert.match(iframe.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}(?:\?start=\d+)?$/);
    }
  });
}

test('YouTube, start time, gear, layout attributes and SVG icon survive', () => {
  const doc = parse(renderContent('[youtube](https://www.youtube.com/watch?v=kYAdwS5MFjQ&t=80s) @@right-small@@'));
  const frame = doc.querySelector('iframe')!;
  assert.ok(frame);
  assert.equal(frame.src, 'https://www.youtube-nocookie.com/embed/kYAdwS5MFjQ?start=80');
  assert.equal(frame.getAttribute('sandbox'), 'allow-scripts allow-same-origin allow-presentation');
  assert.equal(frame.getAttribute('loading'), 'lazy');
  assert.equal(doc.querySelector('.youtube-embed-wrapper')?.getAttribute('data-align'), 'right');
  assert.equal(doc.querySelector('.youtube-embed-wrapper')?.getAttribute('data-size'), 'small');
  assert.ok(doc.querySelector('button.media-adjust-trigger svg path'));
});

test('arbitrary iframe cannot acquire trusted policy', () => {
  assert.equal(parse(sanitizeNoteHtml('<iframe src="//evil.test"></iframe>')).querySelector('iframe'), null);
});

test('Markdown formatting, tables, image references and layout survive', () => {
  const doc = parse(renderContent('# Heading\n\n**bold** and <u>underline</u>\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n![diagram](media_diagram.png) @@left-medium@@'));
  assert.equal(doc.querySelector('h1')?.textContent, 'Heading');
  assert.equal(doc.querySelector('strong')?.textContent, 'bold');
  assert.equal(doc.querySelector('u')?.textContent, 'underline');
  assert.ok(doc.querySelector('.table-wrapper table'));
  assert.equal(doc.querySelector('.image-embed-wrapper')?.getAttribute('data-raw-url'), 'media_diagram.png');
  assert.equal(doc.querySelector('img')?.getAttribute('src'), null);
  assert.equal(doc.querySelector('.image-embed-wrapper')?.getAttribute('data-align'), 'left');
  assert.equal(doc.querySelector('.image-embed-wrapper')?.getAttribute('data-size'), 'medium');
});

test('inline and block LaTeX remain renderable after sanitization', () => {
  const html = renderContent('Energy $E=mc^2$\n\n$$\\frac{a}{b}$$\n\n\\[x^2\\]\n\n\\begin{align}x &= y\\end{align}');
  for (const formula of ['$E=mc^2$', '$$\\frac{a}{b}$$', '\\[x^2\\]', '\\begin{align}x &= y\\end{align}']) {
    assert.ok(parse(html).body.textContent?.includes(formula), formula);
  }
  assert.match(katex.renderToString('E=mc^2', { throwOnError: true }), /katex/);
  assert.match(katex.renderToString('\\frac{a}{b}', { displayMode: true, throwOnError: true }), /katex-display/);
});

test('attribute interpolation cannot create markup from image alt text', () => {
  const doc = parse(renderContent('![\"><strong>injected</strong>](https://example.test/a.png)'));
  assert.equal(doc.querySelector('strong'), null);
  assert.match(doc.querySelector('img')?.alt || '', /<strong>/);
});

test('web and raster data images survive, unsafe image schemes do not', () => {
  assert.ok(parse(sanitizeNoteHtml('<img src="data:image/png;base64,YQ==">')).querySelector('img')?.src.startsWith('data:image/png'));
  assert.equal(parse(sanitizeNoteHtml('<img src="javascript:alert(1)">')).querySelector('img')?.getAttribute('src'), null);
});

test('LaTeX comparison operators and alignment ampersands remain text, not HTML', () => {
  const doc = parse(renderContent('$$a<b>c \\quad x & y$$'));
  assert.equal(doc.body.textContent?.trim(), '$$a<b>c \\quad x & y$$');
  assert.equal(doc.querySelector('b'), null);
});

test('editor highlight color survives but arbitrary mark CSS is stripped', () => {
  const safe = parse(renderContent('<mark style="background-color: #00ff00; color: black; border-radius: 2px; padding: 0 4px;">highlight</mark>'));
  assert.match(safe.querySelector('mark')?.getAttribute('style') || '', /#00ff00/);
  const unsafe = parse(renderContent('<mark style="background:url(https://evil.test); position:fixed">x</mark>'));
  assert.equal(unsafe.querySelector('mark')?.getAttribute('style'), null);
});


test('only vault-issued Blob image URLs survive sanitization', async () => {
  const { registerLocalBlob } = await import('../src/utils/mediaStore');
  const id = await registerLocalBlob(new Blob(['image'], { type: 'image/png' }));
  const doc = parse(renderContent(`![local](${id}) @@right:small@@`));
  assert.match(doc.querySelector('img')?.getAttribute('src') || '', /^blob:/);
  assert.equal(doc.querySelector('.image-embed-wrapper')?.getAttribute('data-align'), 'right');
  assert.equal(parse(sanitizeNoteHtml('<img src="blob:https://evil.test/forged">')).querySelector('img')?.getAttribute('src'), null);
});
