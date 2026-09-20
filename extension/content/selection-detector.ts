/**
 * Handles text selection detection, floating "🔊 Read" button display,
 * and automatic selection reading with debouncing.
 */

export type SelectionCallback = (text: string, rect: DOMRect | null) => void;

export class SelectionDetector {
  private autoReadEnabled: boolean;
  private showButtonEnabled: boolean;
  private onReadSelected: SelectionCallback;
  private floatingButtonEl: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private hostEl: HTMLElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSelectedText = '';

  constructor(
    autoReadEnabled: boolean,
    showButtonEnabled: boolean,
    onReadSelected: SelectionCallback
  ) {
    this.autoReadEnabled = autoReadEnabled;
    this.showButtonEnabled = showButtonEnabled;
    this.onReadSelected = onReadSelected;

    this.initFloatingButton();
    this.attachListeners();
  }

  updateSettings(autoRead: boolean, showButton: boolean): void {
    this.autoReadEnabled = autoRead;
    this.showButtonEnabled = showButton;
    if (!showButton) {
      this.hideButton();
    }
  }

  private initFloatingButton(): void {
    if (typeof document === 'undefined') return;

    // Check if host already exists
    let host = document.getElementById('readingx-selection-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'readingx-selection-host';
      host.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; z-index: 2147483647;';
      document.documentElement.appendChild(host);
    }
    this.hostEl = host;

    this.shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = ''; // clear

    const style = document.createElement('style');
    style.textContent = `
      .readingx-btn {
        all: unset;
        display: none;
        position: fixed;
        align-items: center;
        gap: 6px;
        background: #0284c7;
        color: #ffffff;
        padding: 7px 14px;
        border-radius: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2);
        pointer-events: auto;
        transition: transform 0.12s ease, background 0.15s ease, opacity 0.15s ease;
        opacity: 0;
        transform: translateY(4px) scale(0.95);
        user-select: none;
        z-index: 2147483647;
      }
      .readingx-btn.visible {
        display: inline-flex;
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .readingx-btn:hover {
        background: #0369a1;
        transform: translateY(-1px) scale(1.04);
      }
      .readingx-btn:active {
        transform: translateY(0) scale(0.97);
      }
      .readingx-icon {
        font-size: 15px;
      }
    `;

    const btn = document.createElement('button');
    btn.className = 'readingx-btn';
    btn.setAttribute('aria-label', 'Read selected text aloud');
    btn.innerHTML = `<span class="readingx-icon" aria-hidden="true">🔊</span><span>Read</span>`;

    const triggerRead = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const selection = window.getSelection();
      const currentSelText = selection ? selection.toString().trim() : '';
      const textToRead = currentSelText || this.lastSelectedText;
      if (textToRead) {
        this.hideButton();
        this.onReadSelected(textToRead, null);
      }
    };

    // Listen on pointerdown and click for instant response
    btn.addEventListener('pointerdown', triggerRead);
    btn.addEventListener('click', triggerRead);

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(btn);
    this.floatingButtonEl = btn;
  }

  private attachListeners(): void {
    if (typeof document === 'undefined') return;

    // Detect completed selection
    document.addEventListener('mouseup', () => this.handleSelectionChange());
    document.addEventListener('keyup', (e) => {
      if (['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        this.handleSelectionChange();
      }
    });

    // Hide when clicking outside
    document.addEventListener('mousedown', (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      const isInsideUI = path.some((el) => {
        return (
          el === this.hostEl ||
          el === this.floatingButtonEl ||
          (el instanceof Element && (el.id === 'readingx-selection-host' || el.id === 'readingx-floating-player-host'))
        );
      });
      if (isInsideUI) {
        return;
      }
      this.hideButton();
    });
  }

  private handleSelectionChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        this.hideButton();
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 2) {
        this.hideButton();
        return;
      }

      this.lastSelectedText = selectedText;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Mode 2: Auto read selected text
      if (this.autoReadEnabled) {
        this.hideButton();
        this.onReadSelected(selectedText, rect);
        return;
      }

      // Mode 1: Show floating button
      if (this.showButtonEnabled) {
        this.positionButton(rect);
      }
    }, 60);
  }

  private positionButton(rect: DOMRect): void {
    if (!this.floatingButtonEl) return;

    const btnHeight = 34;
    let top = rect.top - btnHeight - 10;
    if (top < 10) {
      top = rect.bottom + 10;
    }

    let left = rect.left + rect.width / 2 - 45;
    left = Math.max(12, Math.min(window.innerWidth - 100, left));

    this.floatingButtonEl.style.top = `${top}px`;
    this.floatingButtonEl.style.left = `${left}px`;
    this.floatingButtonEl.classList.add('visible');
  }

  hideButton(): void {
    if (this.floatingButtonEl) {
      this.floatingButtonEl.classList.remove('visible');
    }
  }

  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.hostEl?.remove();
  }
}
