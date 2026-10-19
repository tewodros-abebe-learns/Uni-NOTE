import { marked } from 'marked';
import { extractYouTubeId } from './youtube';
import { resolveLocalImage } from '../utils/mediaStore';
import { sanitizeNoteHtml } from './sanitizeNoteHtml';

export const getMediaLayoutStyles = (align: 'left' | 'center' | 'right', size: 'small' | 'medium' | 'large' | 'full', isVideo: boolean = false) => {
  const widthPercent = size === 'small' ? '35%' : size === 'medium' ? '65%' : size === 'large' ? '85%' : '100%';
  const minWidth = size === 'small'
    ? (isVideo ? 'min(280px, 100%)' : 'min(200px, 100%)')
    : size === 'medium'
      ? (isVideo ? 'min(360px, 100%)' : 'min(300px, 100%)')
      : size === 'large' ? (isVideo ? 'min(480px, 100%)' : 'min(400px, 100%)') : '100%';

  let marginLeft = '0';
  let marginRight = 'auto';
  if (align === 'center') {
    marginLeft = 'auto';
    marginRight = 'auto';
  } else if (align === 'right') {
    marginLeft = 'auto';
    marginRight = '0';
  }

  return { widthPercent, minWidth, marginLeft, marginRight };
};

const MEDIA_GEAR_ICON_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 pointer-events-none transition-transform duration-300 group-hover/gear:rotate-45"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

// High-Performance Rendering Helper
export const renderContent = (text: string) => {
  if (!text) return '';

  try {
    let processedText = text;
    const mathBlocks: string[] = [];
    const youtubeBlocks: string[] = [];
    const imageBlocks: string[] = [];

    const getPlaceholder = () => `MATHTOKENX${mathBlocks.length}X`;
    const getYouTubePlaceholder = () => `YOUTUBETOKENX${youtubeBlocks.length}X`;
    const getImagePlaceholder = () => `IMAGETOKENX${imageBlocks.length}X`;

    // Step 0: Extract YouTube video markers
    // Format A: [youtube](URL) optional @@align-size@@
    processedText = processedText.replace(/\[(?:youtube|video|YouTube|VIDEO)\]\(((?:[^()]+|\([^()]*\))+)\)(?:[ \t]*@@(left|center|right)[:-](small|medium|large|full)@@)?/gi, (match, url, alignMatch, sizeMatch) => {
      let cleanUrl = url.trim();
      let align: 'left' | 'center' | 'right' = (alignMatch as any) || 'center';
      let size: 'small' | 'medium' | 'large' | 'full' = (sizeMatch as any) || 'large';
      const insideMarker = cleanUrl.match(/\s*@@(left|center|right)[:-](small|medium|large|full)@@/i);
      if (insideMarker) {
        if (!alignMatch) align = insideMarker[1].toLowerCase() as any;
        if (!sizeMatch) size = insideMarker[2].toLowerCase() as any;
        cleanUrl = cleanUrl.replace(/\s*@@(left|center|right)[:-](small|medium|large|full)@@/gi, '').trim();
      }
      const extracted = extractYouTubeId(cleanUrl);
      if (extracted) {
        const id = getYouTubePlaceholder();
        const { widthPercent, minWidth, marginLeft, marginRight } = getMediaLayoutStyles(align, size, true);
        const startParam = extracted.startTime ? `?start=${extracted.startTime}` : '';
        const embedHtml = `<div class="media-embed-wrapper youtube-embed-wrapper block relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black my-4" data-video-id="${extracted.videoId}" data-raw-url="${escapeAttribute(cleanUrl)}" data-media-type="video" data-align="${align}" data-size="${size}" style="width: ${widthPercent}; max-width: 100%; min-width: ${minWidth}; margin-left: ${marginLeft}; margin-right: ${marginRight}; aspect-ratio: 16/9;"><iframe src="https://www.youtube-nocookie.com/embed/${extracted.videoId}${startParam}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen class="w-full h-full absolute inset-0 rounded-2xl pointer-events-auto" loading="lazy"></iframe><button type="button" class="media-adjust-trigger group/gear pointer-events-auto absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/80 hover:bg-accent hover:text-black text-white/90 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-xl z-30 transition-all cursor-pointer hover:scale-110 active:scale-95" data-video-id="${extracted.videoId}" data-raw-url="${escapeAttribute(cleanUrl)}" data-media-type="video" data-align="${align}" data-size="${size}" title="Adjust Video Size & Alignment" aria-label="Adjust Video Size & Alignment">${MEDIA_GEAR_ICON_HTML}</button></div>`;
        youtubeBlocks.push(embedHtml);
        return `\n\n${id}\n\n`;
      }
      return match;
    });

    // Format B: Standalone YouTube URL lines, optional @@align-size@@
    processedText = processedText.replace(/^([ \t]*)(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s]+|embed\/[^\s]+|shorts\/[^\s]+)|youtu\.be\/[a-zA-Z0-9_-]{11}[^\s]*))(?:[ \t]+@@(left|center|right)[:-](small|medium|large|full)@@)?([ \t]*)$/gim, (match, before, url, alignMatch, sizeMatch, after) => {
      let cleanUrl = url.trim();
      let align: 'left' | 'center' | 'right' = (alignMatch as any) || 'center';
      let size: 'small' | 'medium' | 'large' | 'full' = (sizeMatch as any) || 'large';
      const insideMarker = cleanUrl.match(/\s*@@(left|center|right)[:-](small|medium|large|full)@@/i);
      if (insideMarker) {
        if (!alignMatch) align = insideMarker[1].toLowerCase() as any;
        if (!sizeMatch) size = insideMarker[2].toLowerCase() as any;
        cleanUrl = cleanUrl.replace(/\s*@@(left|center|right)[:-](small|medium|large|full)@@/gi, '').trim();
      }
      const extracted = extractYouTubeId(cleanUrl);
      if (extracted) {
        const id = getYouTubePlaceholder();
        const { widthPercent, minWidth, marginLeft, marginRight } = getMediaLayoutStyles(align, size, true);
        const startParam = extracted.startTime ? `?start=${extracted.startTime}` : '';
        const embedHtml = `<div class="media-embed-wrapper youtube-embed-wrapper block relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black my-4" data-video-id="${extracted.videoId}" data-raw-url="${escapeAttribute(cleanUrl)}" data-media-type="video" data-align="${align}" data-size="${size}" style="width: ${widthPercent}; max-width: 100%; min-width: ${minWidth}; margin-left: ${marginLeft}; margin-right: ${marginRight}; aspect-ratio: 16/9;"><iframe src="https://www.youtube-nocookie.com/embed/${extracted.videoId}${startParam}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen class="w-full h-full absolute inset-0 rounded-2xl pointer-events-auto" loading="lazy"></iframe><button type="button" class="media-adjust-trigger group/gear pointer-events-auto absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/80 hover:bg-accent hover:text-black text-white/90 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-xl z-30 transition-all cursor-pointer hover:scale-110 active:scale-95" data-video-id="${extracted.videoId}" data-raw-url="${escapeAttribute(cleanUrl)}" data-media-type="video" data-align="${align}" data-size="${size}" title="Adjust Video Size & Alignment" aria-label="Adjust Video Size & Alignment">${MEDIA_GEAR_ICON_HTML}</button></div>`;
        youtubeBlocks.push(embedHtml);
        return `\n\n${id}\n\n`;
      }
      return match;
    });

    // Step 0.5: Extract Markdown Images: ![alt](url) optional @@align-size@@
    processedText = processedText.replace(/!\[(.*?)\]\(((?:[^()]+|\([^()]*\))+)\)(?:[ \t]*@@(left|center|right)[:-](small|medium|large|full)@@)?/gi, (match, alt, url, alignMatch, sizeMatch) => {
      let cleanUrl = url.trim();
      let align: 'left' | 'center' | 'right' = (alignMatch as any) || 'center';
      let size: 'small' | 'medium' | 'large' | 'full' = (sizeMatch as any) || 'large';
      const insideMarker = cleanUrl.match(/\s*@@(left|center|right)[:-](small|medium|large|full)@@/i);
      if (insideMarker) {
        if (!alignMatch) align = insideMarker[1].toLowerCase() as any;
        if (!sizeMatch) size = insideMarker[2].toLowerCase() as any;
        cleanUrl = cleanUrl.replace(/\s*@@(left|center|right)[:-](small|medium|large|full)@@/gi, '').trim();
      }
      const id = getImagePlaceholder();
      const { widthPercent, minWidth, marginLeft, marginRight } = getMediaLayoutStyles(align, size, false);
      const displayUrl = resolveLocalImage(cleanUrl);
      const imageHtml = `<div class="media-embed-wrapper image-embed-wrapper block relative rounded-2xl my-4 group/img" data-raw-url="${escapeAttribute(cleanUrl)}" data-media-type="image" data-align="${align}" data-size="${size}" style="width: ${widthPercent}; max-width: 100%; min-width: ${minWidth}; margin-left: ${marginLeft}; margin-right: ${marginRight};"><img ${displayUrl ? `src="${escapeAttribute(displayUrl)}"` : ''} alt="${escapeAttribute(alt || '')}" class="w-full h-auto rounded-2xl shadow-xl border border-white/10 cursor-pointer block transition-all hover:opacity-95" loading="lazy" /><button type="button" class="media-adjust-trigger group/gear pointer-events-auto absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/80 hover:bg-accent hover:text-black text-white/90 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-xl z-30 transition-all cursor-pointer hover:scale-110 active:scale-95" data-raw-url="${escapeAttribute(cleanUrl)}" data-media-type="image" data-align="${align}" data-size="${size}" title="Adjust Image Size & Alignment" aria-label="Adjust Image Size & Alignment">${MEDIA_GEAR_ICON_HTML}</button></div>`;
      imageBlocks.push(imageHtml);
      return `\n\n${id}\n\n`;
    });

    // Step 1: Extract Math Blocks ($$...$$, $...$, \begin{...}...\end{...}, etc.)
    processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
      const id = getPlaceholder();
      mathBlocks.push(match);
      return id;
    });

    processedText = processedText.replace(/\\begin\{([\s\S]+?)\}([\s\S]+?)\\end\{\1\}/g, (match) => {
      const id = getPlaceholder();
      mathBlocks.push(match);
      return id;
    });

    processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (match) => {
      const id = getPlaceholder();
      mathBlocks.push(match);
      return id;
    });

    processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (match) => {
      const id = getPlaceholder();
      mathBlocks.push(match);
      return id;
    });

    processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match) => {
      const id = getPlaceholder();
      mathBlocks.push(match);
      return id;
    });

    // Step 2: Run marked.parse() on the remaining text
    let html = marked.parse(processedText, { async: false }) as string;

    // Clean up <p> tags wrapping block media placeholders to maintain strict valid block hierarchy
    html = html.replace(/<p>\s*(YOUTUBETOKENX\d+X|IMAGETOKENX\d+X)\s*<\/p>/g, '$1');

    // Step 3: Loop through placeholders and re-inject math strings
    mathBlocks.forEach((rawMath, i) => {
      html = html.replace(`MATHTOKENX${i}X`, () => escapeAttribute(rawMath));
    });

    // Step 3.5: Re-inject YouTube embed wrappers
    youtubeBlocks.forEach((embedHtml, i) => {
      html = html.replace(`YOUTUBETOKENX${i}X`, () => embedHtml);
    });

    // Step 3.6: Re-inject Image wrappers
    imageBlocks.forEach((imgHtml, i) => {
      html = html.replace(`IMAGETOKENX${i}X`, () => imgHtml);
    });

    // Step 3.7: Clean any stray @@align-size@@ markers from text
    html = html.replace(/\s*@@(?:left|center|right)[:-](?:small|medium|large|full)@@/gi, '');

    // Step 4: Hide leaked image references if any
    html = html.replace(/!\[Pasted Image\]\[img_\d+\]/g, '<span class="hidden-image-ref">$&</span>');

    // Step 5: Responsive Horizontal Tables
    const responsiveHtml = html.replace(/<table/g, '<div class="table-wrapper"><table').replace(/<\/table>/g, '</table></div>');

    return sanitizeNoteHtml(responsiveHtml);
  } catch (e) {
    return sanitizeNoteHtml(text);
  }
};
