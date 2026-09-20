import { TextChunk, UserSettings } from '../../shared/types.ts';
import { createChunksFromText } from '../utils/chunker.ts';
import { normalizeTextForSpeech } from '../utils/text-normalizer.ts';

const EXCLUDED_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  '.nav',
  '.navbar',
  '.ad',
  '.ads',
  '.advertisement',
  '.sidebar',
  '.cookie-banner',
  '.cookie-notice',
  '.consent-banner',
  '.social-share',
  '.comments',
  '.disqus',
  '.related-posts',
  'script',
  'style',
  'noscript',
  'svg',
  'iframe',
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '#readingx-selection-host',
  '#readingx-floating-player-host'
];

interface ExtractedBlock {
  type: TextChunk['type'];
  element: HTMLElement;
  text: string;
}

export class PageReader {
  /**
   * Discovers and extracts the primary content container of the current webpage
   */
  static findMainContentContainer(): HTMLElement {
    // 1. Explicit semantic elements
    const article = document.querySelector('article');
    if (article && this.hasSignificantText(article)) {
      return article as HTMLElement;
    }

    const main = document.querySelector('main, [role="main"]');
    if (main && this.hasSignificantText(main as HTMLElement)) {
      return main as HTMLElement;
    }

    // 2. Common article wrappers on Wikipedia, blogs, news sites
    const commonWrappers = [
      '#content',
      '#bodyContent', // Wikipedia
      '.article-content',
      '.post-content',
      '.entry-content',
      '.main-content',
      '.story-body',
      '.docs-content'
    ];

    for (const selector of commonWrappers) {
      const el = document.querySelector(selector);
      if (el && this.hasSignificantText(el as HTMLElement)) {
        return el as HTMLElement;
      }
    }

    // 3. Fallback: Score containers by paragraph text density
    return this.findHighestDensityContainer() || document.body;
  }

  private static hasSignificantText(el: HTMLElement): boolean {
    const text = el.innerText || el.textContent || '';
    return text.trim().length > 200;
  }

  private static findHighestDensityContainer(): HTMLElement | null {
    const candidates = document.querySelectorAll('div, section');
    let bestEl: HTMLElement | null = null;
    let maxScore = 0;

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i] as HTMLElement;
      if (this.isExcluded(el)) continue;

      const paragraphs = el.querySelectorAll('p');
      if (paragraphs.length < 2) continue;

      let paraTextLen = 0;
      for (let p = 0; p < paragraphs.length; p++) {
        paraTextLen += (paragraphs[p].textContent || '').trim().length;
      }

      const totalLen = (el.textContent || '').trim().length;
      if (totalLen === 0) continue;

      // Score based on paragraph proportion and total paragraph length
      const score = (paraTextLen / totalLen) * paraTextLen;
      if (score > maxScore) {
        maxScore = score;
        bestEl = el;
      }
    }

    return bestEl;
  }

  private static isExcluded(el: HTMLElement): boolean {
    for (const sel of EXCLUDED_SELECTORS) {
      if (el.matches(sel) || el.closest(sel)) {
        return true;
      }
    }

    // Check visibility
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return true;
    }

    return false;
  }

  /**
   * Extracts clean blocks from the container
   */
  static extractBlocks(container: HTMLElement): ExtractedBlock[] {
    const blocks: ExtractedBlock[] = [];
    const elements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, pre, code, blockquote');

    const seenTexts = new Set<string>();

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      if (this.isExcluded(el)) continue;

      const text = (el.innerText || el.textContent || '').trim();
      if (!text || text.length < 3) continue;

      // Deduplicate identical adjacent headers/paragraphs
      if (seenTexts.has(text)) continue;
      seenTexts.add(text);

      const tagName = el.tagName.toLowerCase();
      let type: TextChunk['type'] = 'paragraph';

      if (/^h[1-6]$/.test(tagName)) {
        type = 'heading';
      } else if (tagName === 'li') {
        type = 'list-item';
      } else if (tagName === 'pre' || tagName === 'code') {
        type = 'code';
      }

      blocks.push({
        type,
        element: el,
        text
      });
    }

    return blocks;
  }

  /**
   * Generates clean audio chunks for the whole page
   */
  static extractPageChunks(settings: UserSettings): TextChunk[] {
    const container = this.findMainContentContainer();
    const blocks = this.extractBlocks(container);

    const allChunks: TextChunk[] = [];
    let chunkCounter = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // If code handling is 'skip' and block is code, omit it
      if (block.type === 'code' && settings.codeHandling === 'skip') {
        continue;
      }

      const normalized = normalizeTextForSpeech(block.text, {
        codeHandling: settings.codeHandling,
        mathNormalization: settings.mathNormalization,
        urlNormalization: settings.urlNormalization,
        listNormalization: settings.listNormalization
      });

      const chunks = createChunksFromText(normalized, block.type, {
        maxChunkSize: settings.chunkSize,
        lang: settings.language
      });

      for (const ch of chunks) {
        ch.elementIndex = i;
        ch.rawText = block.text;
        allChunks.push({
          ...ch,
          id: `page_chunk_${++chunkCounter}`
        });
      }
    }

    // Set totals
    const total = allChunks.length;
    for (let i = 0; i < total; i++) {
      allChunks[i].index = i;
      allChunks[i].totalChunks = total;
    }

    return allChunks;
  }
}
