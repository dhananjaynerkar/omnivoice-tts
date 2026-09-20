import { TextChunk } from '../../shared/types.ts';

/**
 * Splits text into sentences using Intl.Segmenter if available,
 * with fallback to regex sentence boundary detection.
 */
export function splitIntoSentences(text: string, lang = 'en'): string[] {
  if (!text || text.trim().length === 0) return [];

  // Try Intl.Segmenter (standard in modern Chrome)
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      // @ts-expect-error Segmenter is part of ES2022/DOM
      const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
      const segments = segmenter.segment(text);
      const sentences: string[] = [];
      for (const seg of segments) {
        const s = seg.segment.trim();
        if (s) sentences.push(s);
      }
      if (sentences.length > 0) return sentences;
    } catch {
      // Fall through to regex fallback
    }
  }

  // Regex fallback handling periods, exclamation marks, question marks, and Hindi/Marathi purna viram (।)
  const parts = text.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g);
  if (!parts) return [text.trim()];

  return parts.map(s => s.trim()).filter(Boolean);
}

export interface ChunkOptions {
  maxChunkSize?: number; // default ~250 chars for Web Speech stability
  lang?: string;
}

/**
 * Intelligent chunker that breaks text into natural sentence groups
 * without truncating words or splitting sentences in the middle.
 */
export function createChunksFromText(
  rawText: string,
  type: TextChunk['type'] = 'paragraph',
  options: ChunkOptions = {}
): TextChunk[] {
  const maxChunkSize = options.maxChunkSize || 250;
  const lang = options.lang || 'en';

  if (!rawText || rawText.trim().length === 0) {
    return [];
  }

  // Split into paragraphs first
  const paragraphs = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const result: TextChunk[] = [];
  let chunkCounter = 0;

  for (const para of paragraphs) {
    const sentences = splitIntoSentences(para, lang);
    let currentChunkText = '';
    let currentRawSentences: string[] = [];

    for (const sentence of sentences) {
      // If a single sentence exceeds maxChunkSize, split it by clauses (commas, semicolons)
      if (sentence.length > maxChunkSize) {
        // Flush previous chunk if any
        if (currentChunkText) {
          result.push({
            id: `chunk_${++chunkCounter}`,
            index: chunkCounter - 1,
            totalChunks: 0, // will be updated at end
            text: currentChunkText.trim(),
            rawText: currentRawSentences.join(' '),
            type
          });
          currentChunkText = '';
          currentRawSentences = [];
        }

        // Subdivide long sentence by punctuation
        const clauses = sentence.match(/[^,;:—]+[,;:—]+|[^,;:—]+$/g) || [sentence];
        let subChunk = '';
        for (const clause of clauses) {
          if (subChunk.length + clause.length > maxChunkSize && subChunk.length > 0) {
            result.push({
              id: `chunk_${++chunkCounter}`,
              index: chunkCounter - 1,
              totalChunks: 0,
              text: subChunk.trim(),
              rawText: subChunk.trim(),
              type
            });
            subChunk = clause;
          } else {
            subChunk += (subChunk ? ' ' : '') + clause;
          }
        }
        if (subChunk.trim()) {
          result.push({
            id: `chunk_${++chunkCounter}`,
            index: chunkCounter - 1,
            totalChunks: 0,
            text: subChunk.trim(),
            rawText: subChunk.trim(),
            type
          });
        }
        continue;
      }

      // Check if adding this sentence exceeds maxChunkSize
      if (currentChunkText.length + sentence.length + 1 > maxChunkSize && currentChunkText.length > 0) {
        result.push({
          id: `chunk_${++chunkCounter}`,
          index: chunkCounter - 1,
          totalChunks: 0,
          text: currentChunkText.trim(),
          rawText: currentRawSentences.join(' '),
          type
        });
        currentChunkText = sentence;
        currentRawSentences = [sentence];
      } else {
        currentChunkText += (currentChunkText ? ' ' : '') + sentence;
        currentRawSentences.push(sentence);
      }
    }

    // Flush remaining chunk for this paragraph
    if (currentChunkText.trim()) {
      result.push({
        id: `chunk_${++chunkCounter}`,
        index: chunkCounter - 1,
        totalChunks: 0,
        text: currentChunkText.trim(),
        rawText: currentRawSentences.join(' '),
        type
      });
    }
  }

  // Update totalChunks on all items
  const total = result.length;
  for (let i = 0; i < total; i++) {
    result[i].totalChunks = total;
    result[i].index = i;
  }

  return result;
}
