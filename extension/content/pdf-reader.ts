import { TextChunk, UserSettings } from '../../shared/types.ts';
import { createChunksFromText } from '../utils/chunker.ts';
import { normalizeTextForSpeech } from '../utils/text-normalizer.ts';

export class PDFReader {
  /**
   * Checks if current page is displaying a PDF document
   */
  static isPDFDocument(): boolean {
    const isPdfUrl = /\.pdf($|\?|#)/i.test(window.location.href);
    const isPdfMime = document.contentType === 'application/pdf';
    const hasPdfEmbed = !!document.querySelector('embed[type="application/pdf"]');
    return isPdfUrl || isPdfMime || hasPdfEmbed;
  }

  /**
   * Attempts to extract text from a PDF document by fetching its raw binary
   * and parsing text streams (or forwarding to PDF extraction engine).
   */
  static async extractPDFText(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      return this.parsePdfBufferToText(buffer);
    } catch (err) {
      console.warn('Direct PDF binary text extraction failed:', err);
      return '';
    }
  }

  /**
   * Parses basic unencrypted PDF text streams without external heavy binary dependencies
   */
  private static parsePdfBufferToText(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder('latin1');
    const pdfData = decoder.decode(buffer);

    const textPieces: string[] = [];

    // Extract text between BT (Begin Text) and ET (End Text) operators
    const textStreamRegex = /BT[\s\S]*?ET/g;
    const matches = pdfData.match(textStreamRegex);

    if (matches && matches.length > 0) {
      for (const block of matches) {
        // Look for string literals in ( ... ) Tj or [ ... ] TJ
        const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g);
        if (tjMatches) {
          for (const tj of tjMatches) {
            const inner = tj.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
            if (inner.trim()) {
              textPieces.push(inner);
            }
          }
        }

        // TJ array matches: [(Hello) 10 (World)] TJ
        const arrayMatches = block.match(/\[(.*?)\]\s*TJ/g);
        if (arrayMatches) {
          for (const arr of arrayMatches) {
            const strings = arr.match(/\(([^)]*)\)/g);
            if (strings) {
              const joined = strings.map(s => s.slice(1, -1)).join(' ');
              if (joined.trim()) {
                textPieces.push(joined);
              }
            }
          }
        }
      }
    }

    if (textPieces.length > 0) {
      return textPieces.join(' ').replace(/\s{2,}/g, ' ');
    }

    return '';
  }

  /**
   * Converts extracted PDF text into TTS playback chunks
   */
  static async createPDFChunks(settings: UserSettings): Promise<TextChunk[]> {
    const extracted = await this.extractPDFText(window.location.href);
    if (!extracted) {
      return [];
    }

    const normalized = normalizeTextForSpeech(extracted, {
      codeHandling: settings.codeHandling,
      mathNormalization: settings.mathNormalization,
      urlNormalization: settings.urlNormalization,
      listNormalization: settings.listNormalization
    });

    return createChunksFromText(normalized, 'paragraph', {
      maxChunkSize: settings.chunkSize,
      lang: settings.language
    });
  }
}
