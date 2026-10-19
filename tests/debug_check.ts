import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://uninote.test' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });

async function run() {
  const { renderContent } = await import('../src/lib/renderContent');
  const { updateMediaMarker, isMediaLine } = await import('../src/lib/sectionContent');
  const { promoteMediaContent } = await import('../src/lib/mediaPromotion');

  console.log('--- Test 1: updateMediaMarker ---');
  const line1 = '![Pasted Image](media_123.png) @@center:medium@@';
  console.log('line1:', line1);
  console.log('isMediaLine(line1):', isMediaLine(line1));
  const updated1 = updateMediaMarker(line1, 'left', 'small');
  console.log('updated1:', updated1);

  console.log('--- Test 2: promoteMediaContent ---');
  const content = 'Hello\n\n![Pasted Image](media_123.png) @@center:medium@@\n\nWorld';
  const promoted = await promoteMediaContent(content, async (id) => 'https://firebasestorage.googleapis.com/v0/b/bucket/o/' + id + '?alt=media&token=xyz');
  console.log('promoted content:\n', promoted);
  console.log('renderContent on promoted:\n', renderContent(promoted));

  console.log('--- Test 3: What if marker is inside parens? ---');
  const contentWithInside = '![Pasted Image](media_123.png @@center:medium@@)';
  const promotedInside = await promoteMediaContent(contentWithInside, async (id) => 'https://firebasestorage.googleapis.com/v0/b/bucket/o/' + id + '?alt=media&token=xyz');
  console.log('promotedInside:\n', promotedInside);
  console.log('renderContent on promotedInside:\n', renderContent(promotedInside));

  console.log('--- Test 4: Video updateMediaMarker ---');
  const vidLine = '[youtube](https://www.youtube.com/watch?v=kYAdwS5MFjQ) @@center:medium@@';
  console.log('isMediaLine(vidLine):', isMediaLine(vidLine));
  const updatedVid = updateMediaMarker(vidLine, 'right', 'large');
  console.log('updatedVid:', updatedVid);
  console.log('renderContent on updatedVid:\n', renderContent(updatedVid));

  console.log('--- Test 5: Local media image without blob ---');
  const { resolveLocalImage } = await import('../src/utils/mediaStore');
  console.log('resolveLocalImage("media_test.png"):', resolveLocalImage('media_test.png'));
  console.log('renderContent with media_test.png:\n', renderContent('![Image](media_test.png) @@center:small@@'));
}

run().catch(console.error);
