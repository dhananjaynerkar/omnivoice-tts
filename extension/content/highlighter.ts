import { TextChunk } from '../../shared/types.ts';

/**
 * Highlights active elements or paragraphs during speech playback
 * without corrupting the underlying DOM or layout.
 */
export class DOMHighlighter {
  private currentHighlightedEl: HTMLElement | null = null;
  private autoScroll: boolean;
  private highlightStyleEl: HTMLStyleElement | null = null;

  constructor(autoScroll = true) {
    this.autoScroll = autoScroll;
    this.injectHighlightStyles();
  }

  setAutoScroll(enabled: boolean): void {
    this.autoScroll = enabled;
  }

  private injectHighlightStyles(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById('readingx-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'readingx-highlight-styles';
    style.textContent = `
      .readingx-active-highlight {
        background-color: rgba(254, 240, 138, 0.45) !important;
        outline: 2px solid rgba(234, 179, 8, 0.75) !important;
        border-radius: 4px !important;
        transition: background-color 0.2s ease, outline 0.2s ease;
      }
    `;
    document.head?.appendChild(style);
    this.highlightStyleEl = style;
  }

  highlightChunk(chunk: TextChunk | null): void {
    this.clearHighlight();
    if (!chunk) return;

    let targetEl: HTMLElement | null = null;

    // 1. Try DOM selector if attached during page extraction
    if (chunk.domSelector) {
      targetEl = document.querySelector(chunk.domSelector);
    }

    // 2. Try elementIndex if selector didn't match
    if (!targetEl && typeof chunk.elementIndex === 'number') {
      const candidates = document.querySelectorAll('article p, main p, p, h1, h2, h3, h4, li');
      if (candidates[chunk.elementIndex]) {
        targetEl = candidates[chunk.elementIndex] as HTMLElement;
      }
    }

    // 3. Fallback: Search for element containing chunk raw text
    if (!targetEl && chunk.rawText && chunk.rawText.length > 15) {
      targetEl = this.findElementWithText(chunk.rawText.slice(0, 40));
    }

    if (targetEl) {
      targetEl.classList.add('readingx-active-highlight');
      this.currentHighlightedEl = targetEl;

      if (this.autoScroll) {
        const rect = targetEl.getBoundingClientRect();
        const isInViewport =
          rect.top >= 50 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - 50;

        if (!isInViewport) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  clearHighlight(): void {
    if (this.currentHighlightedEl) {
      this.currentHighlightedEl.classList.remove('readingx-active-highlight');
      this.currentHighlightedEl = null;
    }
  }

  private findElementWithText(snippet: string): HTMLElement | null {
    const candidates = document.querySelectorAll('p, h1, h2, h3, h4, li, blockquote');
    const cleanSnippet = snippet.trim().toLowerCase();

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i] as HTMLElement;
      if (el.textContent && el.textContent.toLowerCase().includes(cleanSnippet)) {
        return el;
      }
    }
    return null;
  }

  destroy(): void {
    this.clearHighlight();
    this.highlightStyleEl?.remove();
  }
}
