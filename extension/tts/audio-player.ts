import { TTSProvider } from './tts-provider.ts';
import { BrowserTTSProvider } from './browser-tts.ts';
import { GoogleGeminiTTSProvider } from './google-tts.ts';
import { CompanionTTSProvider } from './companion-tts.ts';
import { TextChunk, PlaybackState, PlayerStatus, UserSettings } from '../../shared/types.ts';

export type PlayerStateListener = (status: PlayerStatus) => void;
export type ChunkChangeListener = (chunk: TextChunk | null) => void;

export class AudioPlayer {
  private currentProvider: TTSProvider;
  private browserProvider: BrowserTTSProvider;
  private googleProvider: GoogleGeminiTTSProvider;
  private companionProvider: CompanionTTSProvider;

  private queue: TextChunk[] = [];
  private currentIndex = -1;
  private state: PlaybackState = 'idle';
  private settings: UserSettings;

  private stateListeners: Set<PlayerStateListener> = new Set();
  private chunkListeners: Set<ChunkChangeListener> = new Set();

  private isCancelling = false;

  constructor(settings: UserSettings) {
    this.settings = settings;

    this.browserProvider = new BrowserTTSProvider();
    this.googleProvider = new GoogleGeminiTTSProvider(
      settings.geminiApiKey,
      settings.geminiModel,
      settings.aiMode,
      settings.targetLanguage
    );
    this.companionProvider = new CompanionTTSProvider(
      settings.companionHost,
      settings.companionPort,
      settings.companionToken
    );

    this.currentProvider = this.resolveProvider(settings.ttsProvider);
  }

  async initialize(): Promise<void> {
    await this.browserProvider.initialize();
    if (this.settings.ttsProvider === 'google') {
      await this.googleProvider.initialize();
    } else if (this.settings.ttsProvider === 'companion') {
      await this.companionProvider.initialize();
    }
  }

  private resolveProvider(type: UserSettings['ttsProvider']): TTSProvider {
    switch (type) {
      case 'google':
        return this.googleProvider;
      case 'companion':
        return this.companionProvider;
      case 'browser':
      default:
        return this.browserProvider;
    }
  }

  updateSettings(newSettings: UserSettings): void {
    const oldProviderType = this.settings.ttsProvider;
    this.settings = newSettings;

    // Update sub-providers
    this.googleProvider.setApiKey(newSettings.geminiApiKey);
    this.googleProvider.setModel(newSettings.geminiModel);
    this.googleProvider.setAIMode(newSettings.aiMode);
    this.googleProvider.setTargetLanguage(newSettings.targetLanguage);
    this.companionProvider.setConnectionInfo(
      newSettings.companionHost,
      newSettings.companionPort,
      newSettings.companionToken
    );

    if (oldProviderType !== newSettings.ttsProvider) {
      const wasPlaying = this.state === 'playing';
      if (wasPlaying) {
        this.pause();
      }
      this.currentProvider = this.resolveProvider(newSettings.ttsProvider);
      if (wasPlaying) {
        this.resume();
      }
    }
    this.notifyState();
  }

  getProvider(): TTSProvider {
    return this.currentProvider;
  }

  async getAvailableVoices() {
    return this.currentProvider.getVoices();
  }

  onStateChange(listener: PlayerStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getStatus());
    return () => this.stateListeners.delete(listener);
  }

  onChunkChange(listener: ChunkChangeListener): () => void {
    this.chunkListeners.add(listener);
    listener(this.getCurrentChunk());
    return () => this.chunkListeners.delete(listener);
  }

  getStatus(): PlayerStatus {
    const currentChunk = this.getCurrentChunk();
    return {
      state: this.state,
      currentChunkIndex: this.currentIndex,
      totalChunks: this.queue.length,
      currentText: currentChunk ? currentChunk.text : '',
      provider: this.settings.ttsProvider,
      rate: this.settings.rate,
      volume: this.settings.volume
    };
  }

  getCurrentChunk(): TextChunk | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  private notifyState(errorMsg?: string): void {
    const status = this.getStatus();
    if (errorMsg) {
      status.errorMessage = errorMsg;
    }
    for (const listener of this.stateListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in state listener', err);
      }
    }
  }

  private notifyChunk(chunk: TextChunk | null): void {
    for (const listener of this.chunkListeners) {
      try {
        listener(chunk);
      } catch (err) {
        console.error('Error in chunk listener', err);
      }
    }
  }

  /**
   * Loads chunks into the queue and starts playback immediately
   */
  async playChunks(chunks: TextChunk[], startIndex = 0): Promise<void> {
    this.stop();
    this.queue = chunks;
    this.currentIndex = Math.max(0, Math.min(startIndex, chunks.length - 1));
    this.isCancelling = false;

    if (chunks.length === 0) {
      this.state = 'idle';
      this.notifyState();
      return;
    }

    await this.playCurrentChunk();
  }

  private async playCurrentChunk(): Promise<void> {
    if (this.isCancelling) return;

    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) {
      this.state = 'idle';
      this.currentIndex = -1;
      this.notifyChunk(null);
      this.notifyState();
      return;
    }

    const chunk = this.queue[this.currentIndex];
    this.state = 'playing';
    this.notifyChunk(chunk);
    this.notifyState();

    try {
      await this.currentProvider.speak(chunk, {
        voiceURI: this.settings.voiceURI,
        lang: this.settings.language,
        rate: this.settings.rate,
        pitch: this.settings.pitch,
        volume: this.settings.volume,
        onEnd: () => {
          if (!this.isCancelling && this.state === 'playing') {
            const pauseTime = chunk.type === 'heading' ? this.settings.paragraphPauseMs : this.settings.sentencePauseMs;
            setTimeout(() => {
              if (!this.isCancelling && this.state === 'playing') {
                this.currentIndex++;
                this.playCurrentChunk();
              }
            }, pauseTime);
          }
        },
        onError: (err) => {
          if (!this.isCancelling) {
            console.error('TTS playback error:', err);
            this.state = 'error';
            this.notifyState(err.message);
          }
        }
      });
    } catch (err) {
      if (!this.isCancelling) {
        this.state = 'error';
        this.notifyState((err as Error).message);
      }
    }
  }

  pause(): void {
    if (this.state === 'playing') {
      this.currentProvider.pause();
      this.state = 'paused';
      this.notifyState();
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.currentProvider.resume();
      this.notifyState();
    }
  }

  stop(): void {
    this.isCancelling = true;
    this.currentProvider.stop();
    this.state = 'stopped';
    this.notifyChunk(null);
    this.notifyState();
  }

  skipForward(): void {
    if (this.currentIndex < this.queue.length - 1) {
      this.stopCurrentSpeechOnly();
      this.currentIndex++;
      this.playCurrentChunk();
    } else {
      this.stop();
    }
  }

  skipBackward(): void {
    if (this.currentIndex > 0) {
      this.stopCurrentSpeechOnly();
      this.currentIndex--;
      this.playCurrentChunk();
    } else {
      this.replayChunk();
    }
  }

  replayChunk(): void {
    this.stopCurrentSpeechOnly();
    this.playCurrentChunk();
  }

  setRate(rate: number): void {
    this.settings.rate = Math.max(0.5, Math.min(3.0, rate));
    if (this.state === 'playing') {
      this.replayChunk();
    } else {
      this.notifyState();
    }
  }

  private stopCurrentSpeechOnly(): void {
    this.isCancelling = false;
    this.currentProvider.stop();
  }
}
