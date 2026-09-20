import { TTSProvider, TTSPlaybackOptions } from './tts-provider.ts';
import { VoiceInfo, TextChunk } from '../../shared/types.ts';

export class BrowserTTSProvider implements TTSProvider {
  readonly id = 'browser';
  readonly name = 'Browser SpeechSynthesis (Native)';
  readonly isLocal = true;

  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isInitialized = false;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('SpeechSynthesis is not available in this environment');
      return;
    }

    await this.loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }

    this.isInitialized = true;
  }

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        this.voices = v;
        resolve(v);
        return;
      }

      const onVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
        window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
        resolve(this.voices);
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoices);

      setTimeout(() => {
        this.voices = window.speechSynthesis.getVoices();
        resolve(this.voices);
      }, 500);
    });
  }

  async getVoices(): Promise<VoiceInfo[]> {
    if (this.voices.length === 0) {
      await this.loadVoices();
    }

    return this.voices.map(v => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      default: v.default,
      localService: v.localService,
      provider: 'browser'
    }));
  }

  supports(language: string): boolean {
    const langPrefix = language.split('-')[0].toLowerCase();
    return this.voices.some(v => v.lang.toLowerCase().startsWith(langPrefix));
  }

  supportsStreaming(): boolean {
    return false;
  }

  speak(chunk: TextChunk, options: TTSPlaybackOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        reject(new Error('SpeechSynthesis not supported'));
        return;
      }

      // In Chrome: only cancel if something is actively speaking/pending
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }

      // Ensure speech synthesis is unpaused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(chunk.text);
      this.currentUtterance = utterance;

      if (options.rate !== undefined) utterance.rate = Math.max(0.1, Math.min(3.0, options.rate));
      if (options.pitch !== undefined) utterance.pitch = Math.max(0, Math.min(2.0, options.pitch));
      if (options.volume !== undefined) utterance.volume = Math.max(0, Math.min(1.0, options.volume));

      // Match voice flexibly
      if (options.voiceURI) {
        const found = this.voices.find(v => v.voiceURI === options.voiceURI);
        if (found) {
          utterance.voice = found;
          utterance.lang = found.lang;
        }
      } else if (options.lang) {
        let found = this.voices.find(v => v.lang.toLowerCase() === options.lang?.toLowerCase());
        if (!found) {
          const prefix = options.lang.split('-')[0].toLowerCase();
          found = this.voices.find(v => v.lang.toLowerCase().startsWith(prefix));
        }
        if (found) {
          utterance.voice = found;
          utterance.lang = found.lang;
        }
      }

      // Fallback to default or first available system voice
      if (!utterance.voice && this.voices.length > 0) {
        const def = this.voices.find(v => v.default) || this.voices[0];
        if (def) {
          utterance.voice = def;
          utterance.lang = def.lang;
        }
      }

      utterance.onstart = () => {
        this.startWatchdog();
        options.onStart?.();
      };

      utterance.onend = () => {
        this.clearWatchdog();
        this.currentUtterance = null;
        options.onEnd?.();
        resolve();
      };

      utterance.onerror = (e) => {
        this.clearWatchdog();
        this.currentUtterance = null;
        if (e.error === 'interrupted' || e.error === 'canceled') {
          resolve();
          return;
        }
        console.warn('SpeechSynthesis error event:', e);
        const err = new Error(`TTS Error: ${e.error}`);
        options.onError?.(err);
        reject(err);
      };

      if (options.onBoundary) {
        utterance.onboundary = (e) => {
          options.onBoundary?.(e.charIndex);
        };
      }

      window.speechSynthesis.speak(utterance);

      // Force resume in case browser queued it in paused state
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    });
  }

  pause(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  }

  resume(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  }

  stop(): void {
    this.clearWatchdog();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    }
    this.currentUtterance = null;
  }

  private startWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}
