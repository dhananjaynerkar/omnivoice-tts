import { VoiceInfo, TextChunk } from '../../shared/types.ts';

export interface TTSPlaybackOptions {
  voiceURI?: string;
  lang?: string;
  rate?: number; // 0.5 - 3.0
  pitch?: number; // 0.5 - 2.0
  volume?: number; // 0.0 - 1.0
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onBoundary?: (charIndex: number) => void;
}

export interface TTSProvider {
  readonly id: string;
  readonly name: string;
  readonly isLocal: boolean;

  initialize(): Promise<void>;
  getVoices(): Promise<VoiceInfo[]>;
  supports(language: string): boolean;
  supportsStreaming(): boolean;

  speak(chunk: TextChunk, options?: TTSPlaybackOptions): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
}
