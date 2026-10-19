import { extractYouTubeId } from './youtube';

export const isMediaLine = (line: string): boolean => {
  if (!line || typeof line !== 'string') return false;
  const text = line.trim()
    .replace(/\s*@@(?:left|center|right)[:-](?:small|medium|large|full)@@/gi, '')
    .replace(/(\]\([^)]*?)\s*@@(?:left|center|right)[:-](?:small|medium|large|full)@@/gi, '$1')
    .trim();
  if (/^!\[.*?\]\(((?:[^()]+|\([^()]*\))+)\)$/.test(text)) return true;
  if (/^\[(?:youtube|video)\]\(((?:[^()]+|\([^()]*\))+)\)$/i.test(text)) return true;
  if (/^media_[a-zA-Z0-9._-]+$/.test(text)) return true;
  return /^https?:\/\/\S+$/.test(text) && Boolean(extractYouTubeId(text) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)(?:[?#].*)?$/i.test(text));
};

export interface ContentSegment {
  id: string;
  type: 'text' | 'media' | 'latex';
  text: string;
  start?: number;
  end?: number;
  media?: {
    lineIndex: number;
    type: 'video' | 'image';
    url: string;
    alt?: string;
    align: 'left' | 'center' | 'right';
    size: 'small' | 'medium' | 'large' | 'full';
    rawTag: string;
    videoId?: string;
  };
  latex?: {
    rawFormula: string;
    displayMode: boolean;
  };
}

export const parseContentIntoSegments = (content: string): ContentSegment[] => {
  if (!content) {
    return [{ id: 'text_empty', type: 'text', text: '' }];
  }

  const lines = content.split('\n');
  const segments: ContentSegment[] = [];
  let currentTextLines: string[] = [];

  const flushText = () => {
    if (currentTextLines.length > 0) {
      segments.push({
        id: `text_${segments.length}`,
        type: 'text',
        text: currentTextLines.join('\n')
      });
      currentTextLines = [];
    }
  };

  let fence: string | null = null;
  let inLatex = false;
  let latexLines: string[] = [];
  let latexStartLine = 0;
  const environments: string[] = [];
  const consumeEnvironments = (line: string) => {
    for (const match of line.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
      if (match[1] === 'begin') environments.push(match[2]);
      else if (environments.at(-1) === match[2]) environments.pop();
    }
  };
  let latexClosingTrigger: '$$' | '\\]' | '\\end' = '$$';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code is literal, including any image or LaTeX-looking lines.
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (!inLatex && (fence || fenceMatch)) {
      currentTextLines.push(line);
      if (!fence) fence = fenceMatch![1];
      else if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      continue;
    }

    if (inLatex) {
      latexLines.push(line);
      let isClosed = false;
      if (latexClosingTrigger === '$$' && (trimmed === '$$' || (trimmed.endsWith('$$') && trimmed.length > 2))) {
        isClosed = true;
      } else if (latexClosingTrigger === '\\]' && (trimmed === '\\]' || trimmed.endsWith('\\]'))) {
        isClosed = true;
      } else if (latexClosingTrigger === '\\end') {
        consumeEnvironments(line);
        isClosed = environments.length === 0;
      }

      if (isClosed) {
        const fullFormula = latexLines.join('\n');
        segments.push({
          id: `latex_${latexStartLine}_${i}`,
          type: 'latex',
          text: fullFormula,
          latex: {
            rawFormula: fullFormula,
            displayMode: true
          }
        });
        inLatex = false;
        latexLines = [];
      }
      continue;
    }

    // Check single-line $$ ... $$
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) {
      flushText();
      segments.push({
        id: `latex_${i}`,
        type: 'latex',
        text: line,
        latex: {
          rawFormula: line,
          displayMode: true
        }
      });
      continue;
    }

    // Check single-line \[ ... \]
    if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length > 2) {
      flushText();
      segments.push({
        id: `latex_${i}`,
        type: 'latex',
        text: line,
        latex: {
          rawFormula: line,
          displayMode: true
        }
      });
      continue;
    }

    // Check multi-line $$ start
    if (trimmed.startsWith('$$')) {
      flushText();
      inLatex = true;
      latexStartLine = i;
      latexLines = [line];
      latexClosingTrigger = '$$';
      continue;
    }

    // Check multi-line \[ start
    if (trimmed.startsWith('\\[')) {
      flushText();
      inLatex = true;
      latexStartLine = i;
      latexLines = [line];
      latexClosingTrigger = '\\]';
      continue;
    }

    // Check \begin{aligned} / matrix / cases start
    if (trimmed.startsWith('\\begin{')) {
      flushText();
      inLatex = true;
      latexStartLine = i;
      latexLines = [line];
      latexClosingTrigger = '\\end';
      consumeEnvironments(line);
      if (environments.length === 0) {
        segments.push({ id: `latex_${i}`, type: 'latex', text: line, latex: { rawFormula: line, displayMode: true } });
        inLatex = false;
        latexLines = [];
      }
      continue;
    }

    // Check media line (image or video)
    if (isMediaLine(line)) {
      flushText();

      let mediaType: 'video' | 'image' = 'image';
      let url = '';
      let alt = '';
      let align: 'left' | 'center' | 'right' = 'center';
      let size: 'small' | 'medium' | 'large' | 'full' = 'large';

      const alignMatch = line.match(/@@(left|center|right)[:-](small|medium|large|full)@@/i);
      if (alignMatch) {
        align = alignMatch[1].toLowerCase() as any;
        size = alignMatch[2].toLowerCase() as any;
      }

      const ytBracketMatch = line.match(/\[(?:youtube|video)\]\(((?:[^()]+|\([^()]*\))+)\)/i);
      if (ytBracketMatch) {
        mediaType = 'video';
        url = ytBracketMatch[1].trim();
      } else {
        const ytDirect = extractYouTubeId(line);
        if (ytDirect?.videoId) {
          mediaType = 'video';
          url = `https://www.youtube.com/watch?v=${ytDirect.videoId}${ytDirect.startTime ? `&t=${ytDirect.startTime}s` : ''}`;
        } else {
          const imgMatch = line.match(/!\[(.*?)\]\(((?:[^()]+|\([^()]*\))+)\)/);
          if (imgMatch) {
            mediaType = 'image';
            alt = imgMatch[1];
            url = imgMatch[2].trim();
          } else {
            const raw = line.replace(/@@[a-z0-9-]+@@/gi, '').trim();
            url = raw;
            mediaType = /\.(png|jpe?g|webp|gif|svg)/i.test(raw) ? 'image' : 'video';
          }
        }
      }

      const videoId = mediaType === 'video' ? (extractYouTubeId(url)?.videoId || '') : undefined;

      segments.push({
        id: `media_${i}`,
        type: 'media',
        text: line,
        media: {
          lineIndex: i,
          type: mediaType,
          url,
          alt,
          align,
          size,
          rawTag: line,
          videoId
        }
      });
      continue;
    }

    currentTextLines.push(line);
  }

  if (inLatex && latexLines.length > 0) {
    segments.push({
      id: `latex_${latexStartLine}_end`,
      type: 'latex',
      text: latexLines.join('\n'),
      latex: {
        rawFormula: latexLines.join('\n'),
        displayMode: true
      }
    });
  }

  flushText();

  // If no segments were generated (empty content)
  if (segments.length === 0) {
    return [{ id: 'text_empty', type: 'text', text: '' }];
  }

  let cursor = 0;
  for (const segment of segments) {
    segment.start = content.indexOf(segment.text, cursor);
    segment.end = segment.start + segment.text.length;
    cursor = segment.end;
  }
  return segments;
};


/** Lossless serialization for the parser's original segment sequence. */
export const serializeSegments = (segments: ContentSegment[]) => segments.map(segment => segment.text).join('\n');

/** Change only the selected source span; never reconstruct neighboring blocks. */
export function replaceSegmentText(content: string, index: number, text: string): string {
  const segment = parseContentIntoSegments(content)[index];
  if (!segment) return content;
  return content.slice(0, segment.start ?? 0) + text + content.slice(segment.end ?? 0);
}
export function deleteSegment(content: string, index: number): string {
  const segment = parseContentIntoSegments(content)[index];
  if (!segment) return content;
  const start = segment.start ?? 0;
  const end = segment.end ?? 0;
  return content.slice(0, start) + content.slice(end);
}
export function updateMediaMarker(line: string, align: 'left' | 'center' | 'right', size: 'small' | 'medium' | 'large' | 'full'): string {
  let cleaned = line
    .replace(/\s*@@(?:left|center|right)[:-](?:small|medium|large|full)@@/gi, '')
    .replace(/(\]\([^)]*?)\s*@@(?:left|center|right)[:-](?:small|medium|large|full)@@/gi, '$1')
    .trimEnd();
  return `${cleaned} @@${align}:${size}@@`;
}

/** If asynchronous paste overlaps unrelated edits, append rather than overwrite them. */
export function insertAtSelection(current: string, base: string, start: number, end: number, insertion: string): string {
  if (current === base) return current.slice(0, start) + insertion + current.slice(end);
  const before = base.slice(0, start);
  const after = base.slice(end);
  if ((before.length > 0 || after.length > 0) && current.startsWith(before) && current.endsWith(after) && before.length + after.length <= current.length) {
    return before + insertion + current.slice(before.length);
  }
  return current + (current.endsWith('\n') ? '' : '\n') + insertion;
}
