import { TTSProvider, TTSPlaybackOptions } from './tts-provider.ts';
import { VoiceInfo, TextChunk } from '../../shared/types.ts';
import { CompanionMessage, DEFAULT_COMPANION_HOST, DEFAULT_COMPANION_PORT } from '../../shared/protocol.ts';

export class CompanionTTSProvider implements TTSProvider {
  readonly id = 'companion';
  readonly name = 'Desktop Companion (Windows Native)';
  readonly isLocal = true;

  private ws: WebSocket | null = null;
  private host: string;
  private port: number;
  private token: string;
  private isConnected = false;
  private availableVoices: VoiceInfo[] = [];

  constructor(host = DEFAULT_COMPANION_HOST, port = DEFAULT_COMPANION_PORT, token = '') {
    this.host = host;
    this.port = port;
    this.token = token;
  }

  setConnectionInfo(host: string, port: number, token: string): void {
    this.host = host;
    this.port = port;
    this.token = token;
    this.reconnect();
  }

  async initialize(): Promise<void> {
    try {
      await this.connect();
    } catch {
      console.warn('Desktop companion not reachable at initialization');
    }
  }

  private connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws && this.isConnected) {
        resolve(true);
        return;
      }

      try {
        const url = `ws://${this.host}:${this.port}/ws`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          // Send auth handshake
          const authMsg: CompanionMessage = {
            type: 'AUTH_REQUEST',
            token: this.token,
            payload: {
              token: this.token,
              clientVersion: '1.0.0',
              origin: typeof chrome !== 'undefined' ? `chrome-extension://${chrome.runtime?.id}` : 'browser'
            },
            timestamp: Date.now()
          };
          this.ws?.send(JSON.stringify(authMsg));
        };

        this.ws.onmessage = (event) => {
          try {
            const data: CompanionMessage = JSON.parse(event.data);
            if (data.type === 'AUTH_RESPONSE') {
              this.isConnected = true;
              resolve(true);
            }
          } catch {
            // Ignore malformed messages
          }
        };

        this.ws.onerror = () => {
          this.isConnected = false;
          resolve(false);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
        };

        // 2-second timeout
        setTimeout(() => {
          if (!this.isConnected) {
            resolve(false);
          }
        }, 2000);
      } catch {
        this.isConnected = false;
        resolve(false);
      }
    });
  }

  private reconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connect();
  }

  async getVoices(): Promise<VoiceInfo[]> {
    return [
      {
        name: 'Windows System Voice (Default)',
        lang: 'en-US',
        voiceURI: 'companion_default',
        default: true,
        localService: true,
        provider: 'companion'
      }
    ];
  }

  supports(language: string): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return false;
  }

  async speak(chunk: TextChunk, options: TTSPlaybackOptions = {}): Promise<void> {
    const connected = await this.connect();
    if (!connected || !this.ws) {
      throw new Error('Desktop Companion is not running or authentication failed. Check Settings > Desktop Companion.');
    }

    return new Promise((resolve, reject) => {
      const msg: CompanionMessage = {
        type: 'SPEAK_REQUEST',
        token: this.token,
        payload: {
          text: chunk.text,
          rate: options.rate,
          pitch: options.pitch,
          volume: options.volume
        },
        timestamp: Date.now()
      };

      const handleMsg = (event: MessageEvent) => {
        try {
          const resp: CompanionMessage = JSON.parse(event.data);
          if (resp.type === 'SPEAK_COMPLETE') {
            this.ws?.removeEventListener('message', handleMsg);
            options.onEnd?.();
            resolve();
          } else if (resp.type === 'ERROR') {
            this.ws?.removeEventListener('message', handleMsg);
            const err = new Error(String(resp.payload));
            options.onError?.(err);
            reject(err);
          }
        } catch {
          // ignore
        }
      };

      this.ws.addEventListener('message', handleMsg);
      this.ws.send(JSON.stringify(msg));
      options.onStart?.();
    });
  }

  pause(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ type: 'PAUSE_REQUEST', token: this.token, payload: {}, timestamp: Date.now() }));
    }
  }

  resume(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ type: 'RESUME_REQUEST', token: this.token, payload: {}, timestamp: Date.now() }));
    }
  }

  stop(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ type: 'STOP_REQUEST', token: this.token, payload: {}, timestamp: Date.now() }));
    }
  }
}
