import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContentIntoSegments, serializeSegments, replaceSegmentText, deleteSegment, updateMediaMarker, insertAtSelection, isMediaLine } from '../src/lib/sectionContent';
const mixed = '# Before\n\n![Image](media_example.png) @@left:small@@\n\nMiddle $E=mc^2$\n\n$$\n\\frac{a}{b}\n$$\n\n[youtube](https://youtu.be/kYAdwS5MFjQ) @@right-large@@\n\nAfter\n';
for (const content of ['', '\n', '\n\n', 'plain\n\ntext\n', mixed, mixed.replace(/\n/g, '\r\n'), '$$unfinished\nline', '```md\n![literal](x.png)\n$$literal$$\n```\n']) {
  test(`parser roundtrip preserves every character: ${JSON.stringify(content).slice(0, 45)}`, () => {
    const segments = parseContentIntoSegments(content);
    assert.equal(serializeSegments(segments), content);
    for (const segment of segments) if (segment.start !== undefined) assert.equal(content.slice(segment.start, segment.end), segment.text);
  });
}
test('structured edits modify only the selected source span', () => {
  const segments = parseContentIntoSegments(mixed);
  const index = segments.findIndex(segment => segment.type === 'text' && segment.text.includes('Middle'));
  const segment = segments[index];
  const changed = replaceSegmentText(mixed, index, 'Updated middle');
  assert.equal(changed, mixed.slice(0, segment.start) + 'Updated middle' + mixed.slice(segment.end));
  for (const token of ['# Before', 'media_example.png', '$$\n\\frac', '[youtube]', 'After']) assert.ok(changed.includes(token));
});
test('deleting one block preserves other blocks including duplicated media URLs', () => {
  const content = 'First\n![a](same.png)\nMiddle\n![b](same.png)\nLast';
  assert.equal(deleteSegment(content, 1), 'First\n\nMiddle\n![b](same.png)\nLast');
});
test('both marker syntaxes parse; updates emit one canonical marker', () => {
  assert.equal(parseContentIntoSegments('![x](a.png) @@right-small@@')[0].media?.size, 'small');
  assert.equal(parseContentIntoSegments('![x](a.png) @@left:medium@@')[0].media?.align, 'left');
  assert.equal(updateMediaMarker('![x](a.png) @@left-small@@ @@right:large@@', 'center', 'medium'), '![x](a.png) @@center:medium@@');
});
test('fenced code and ordinary prose are not classified as exclusive media blocks', () => {
  assert.ok(parseContentIntoSegments('```\n![x](a.png)\n$$x$$\n```').every(segment => segment.type === 'text'));
  assert.equal(isMediaLine('The diagram is called image.png and is explained here.'), false);
  assert.equal(isMediaLine('https://example.test/diagram.png?size=small'), true);
});
test('asynchronous insertions preserve intervening user edits', () => {
  assert.equal(insertAtSelection('abcXYZ', 'abcXYZ', 3, 3, 'image'), 'abcimageXYZ');
  const changed = insertAtSelection('abcNEWXYZ', 'abcXYZ', 3, 3, 'image');
  assert.ok(changed.includes('NEW')); assert.ok(changed.includes('image')); assert.ok(changed.endsWith('XYZ'));
  assert.equal(insertAtSelection('different new edits', 'old', 0, 3, 'image'), 'different new edits\nimage');
});

test('nested LaTeX environments stay one block until the outer environment closes', () => {
  const formula = String.raw`\begin{aligned}
x &= \begin{cases}
1 & x > 0 \\
0 & x = 0
\end{cases} \\
y &= 2
\end{aligned}`;
  const content = `Before\n\n${formula}\n\n![after](image.png)`;
  const segments = parseContentIntoSegments(content);
  assert.equal(segments.filter(segment => segment.type === 'latex').length, 1);
  assert.equal(segments.find(segment => segment.type === 'latex')?.text, formula);
  assert.equal(segments.at(-1)?.type, 'media');
  assert.equal(serializeSegments(segments), content);
});
test('a single-line LaTeX environment is a formula without absorbing neighboring content', () => {
  const formula = String.raw`\begin{matrix} a & b \end{matrix}`;
  const segments = parseContentIntoSegments(`${formula}\nAfter`);
  assert.equal(segments[0].type, 'latex');
  assert.equal(segments[0].text, formula);
  assert.equal(segments[1].text, 'After');
});
