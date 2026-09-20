import { getSettings } from '../utils/storage.ts';
import { UserSettings, ExtensionAction, TextChunk } from '../../shared/types.ts';
import { AudioPlayer } from '../tts/audio-player.ts';
import { SelectionDetector } from './selection-detector.ts';
import { DOMHighlighter } from './highlighter.ts';
import { PageReader } from './page-reader.ts';
import { FloatingPlayer } from './floating-player.ts';
import { PDFReader } from './pdf-reader.ts';
import { createChunksFromText } from '../utils/chunker.ts';
import { normalizeTextForSpeech } from '../utils/text-normalizer.ts';

class ContentCoordinator {
  private settings: UserSettings | null = null;
  private player: AudioPlayer | null = null;
  private selectionDetector: SelectionDetector | null = null;
  private highlighter: DOMHighlighter | null = null;
  private floatingPlayer: FloatingPlayer | null = null;

  async init(): Promise<void> {
    this.settings = await getSettings();

    this.player = new AudioPlayer(this.settings);
    await this.player.initialize();

    this.highlighter = new DOMHighlighter(this.settings.autoScroll);

    this.player.onChunkChange((chunk: TextChunk | null) => {
      if (this.settings?.highlightText) {
        this.highlighter?.highlightChunk(chunk);
      } else {
        this.highlighter?.clearHighlight();
      }
    });

    this.floatingPlayer = new FloatingPlayer(this.player, this.settings);

    this.selectionDetector = new SelectionDetector(
      this.settings.autoReadSelection,
      this.settings.showFloatingButton,
      (text: string) => this.readText(text, 'selection')
    );

    this.setupMessageBridge();
    this.setupKeyboardShortcuts();
  }

  private setupMessageBridge(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    chrome.runtime.onMessage.addListener((message: ExtensionAction, _sender, sendResponse) => {
      this.handleAction(message)
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ error: (err as Error).message }));
      return true; // async response
    });
  }

  private async handleAction(action: ExtensionAction): Promise<unknown> {
    switch (action.type) {
      case 'READ_SELECTION': {
        const text = action.text || window.getSelection()?.toString().trim();
        if (text) {
          await this.readText(text, 'selection');
          return { success: true };
        }
        return { success: false, message: 'No text selected' };
      }

      case 'READ_PAGE': {
        await this.readCurrentPage();
        return { success: true };
      }

      case 'PAUSE_PLAYBACK':
        this.player?.pause();
        return { success: true };

      case 'RESUME_PLAYBACK':
        this.player?.resume();
        return { success: true };

      case 'STOP_PLAYBACK':
        this.player?.stop();
        this.highlighter?.clearHighlight();
        return { success: true };

      case 'SKIP_FORWARD':
        this.player?.skipForward();
        return { success: true };

      case 'SKIP_BACKWARD':
        this.player?.skipBackward();
        return { success: true };

      case 'REPLAY_CHUNK':
        this.player?.replayChunk();
        return { success: true };

      case 'SET_RATE':
        this.player?.setRate(action.rate);
        return { success: true };

      case 'GET_PLAYER_STATUS':
        return this.player?.getStatus();

      case 'SETTINGS_UPDATED':
        this.applySettingsUpdate(action.settings);
        return { success: true };

      case 'COMPANION_CAPTURE_RECEIVED': {
        if (action.text) {
          await this.readText(action.text, 'selection');
        }
        return { success: true };
      }

      default:
        return { ignored: true };
    }
  }

  private setupKeyboardShortcuts(): void {
    // In-page fallback keyboard shortcuts if Chrome command API has latency
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey) {
        if (e.code === 'Space') {
          e.preventDefault();
          const sel = window.getSelection()?.toString().trim();
          if (sel) this.readText(sel, 'selection');
        } else if (e.code === 'KeyP') {
          e.preventDefault();
          const status = this.player?.getStatus();
          if (status?.state === 'playing') this.player?.pause();
          else if (status?.state === 'paused') this.player?.resume();
        } else if (e.code === 'KeyX') {
          e.preventDefault();
          this.player?.stop();
          this.highlighter?.clearHighlight();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          this.readCurrentPage();
        }
      }
    });
  }

  async readText(rawText: string, type: TextChunk['type'] = 'selection'): Promise<void> {
    if (!this.player || !this.settings) return;

    const normalized = normalizeTextForSpeech(rawText, {
      codeHandling: this.settings.codeHandling,
      mathNormalization: this.settings.mathNormalization,
      urlNormalization: this.settings.urlNormalization,
      listNormalization: this.settings.listNormalization
    });

    const chunks = createChunksFromText(normalized, type, {
      maxChunkSize: this.settings.chunkSize,
      lang: this.settings.language
    });

    if (chunks.length > 0) {
      if (this.settings.showFloatingPlayer) {
        this.floatingPlayer?.show();
      }
      await this.player.playChunks(chunks);
    }
  }

  async readCurrentPage(): Promise<void> {
    if (!this.player || !this.settings) return;

    let chunks: TextChunk[] = [];

    // Check if current document is PDF
    if (PDFReader.isPDFDocument()) {
      chunks = await PDFReader.createPDFChunks(this.settings);
    } else {
      chunks = PageReader.extractPageChunks(this.settings);
    }

    if (chunks.length === 0) {
      console.warn('Universal Reader: No readable article text found on this page');
      return;
    }

    if (this.settings.showFloatingPlayer) {
      this.floatingPlayer?.show();
    }
    await this.player.playChunks(chunks);
  }

  private applySettingsUpdate(newSettings: UserSettings): void {
    this.settings = newSettings;
    this.player?.updateSettings(newSettings);
    this.highlighter?.setAutoScroll(newSettings.autoScroll);
    this.floatingPlayer?.updateSettings(newSettings);
    this.selectionDetector?.updateSettings(
      newSettings.autoReadSelection,
      newSettings.showFloatingButton
    );
  }
}

// Initialize content coordinator on page load
const coordinator = new ContentCoordinator();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => coordinator.init());
} else {
  coordinator.init();
}
