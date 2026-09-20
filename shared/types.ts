/**
 * Universal Reader / ReadingX Shared Types
 */

export type TTSProviderType = 'browser' | 'google' | 'companion';

export type AIMode = 'direct' | 'natural' | 'summarize' | 'explain' | 'translate';

export type CodeHandlingMode = 'skip' | 'read' | 'explain';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export interface VoiceInfo {
  name: string;
  lang: string;
  voiceURI: string;
  default: boolean;
  localService: boolean;
  provider: TTSProviderType;
}

export interface TextChunk {
  id: string;
  index: number;
  totalChunks: number;
  text: string;
  rawText: string;
  type: 'paragraph' | 'heading' | 'list-item' | 'code' | 'selection';
  domSelector?: string;
  elementIndex?: number;
}

export interface UserSettings {
  // General
  autoReadSelection: boolean;
  highlightText: boolean;
  showFloatingButton: boolean;
  showFloatingPlayer: boolean;
  autoScroll: boolean;

  // Voice & Provider
  ttsProvider: TTSProviderType;
  voiceURI: string;
  language: string;
  rate: number; // 0.5 - 3.0
  pitch: number; // 0.5 - 2.0
  volume: number; // 0.0 - 1.0

  // AI & Gemini
  geminiApiKey: string;
  geminiModel: string;
  aiMode: AIMode;
  targetLanguage: string; // 'hi', 'mr', 'en', etc.

  // Content Parsing Rules
  codeHandling: CodeHandlingMode;
  mathNormalization: boolean;
  urlNormalization: boolean;
  listNormalization: boolean;
  chunkSize: number; // characters per chunk
  sentencePauseMs: number;
  paragraphPauseMs: number;

  // Desktop Companion
  companionEnabled: boolean;
  companionHost: string;
  companionPort: number;
  companionToken: string;

  // Privacy
  telemetry: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  autoReadSelection: false,
  highlightText: true,
  showFloatingButton: true,
  showFloatingPlayer: true,
  autoScroll: true,

  ttsProvider: 'browser',
  voiceURI: '',
  language: 'en-US',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,

  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  aiMode: 'natural',
  targetLanguage: 'en',

  codeHandling: 'skip',
  mathNormalization: true,
  urlNormalization: true,
  listNormalization: true,
  chunkSize: 250,
  sentencePauseMs: 150,
  paragraphPauseMs: 400,

  companionEnabled: false,
  companionHost: '127.0.0.1',
  companionPort: 8765,
  companionToken: '',

  telemetry: false
};

export interface PlayerStatus {
  state: PlaybackState;
  currentChunkIndex: number;
  totalChunks: number;
  currentText: string;
  provider: TTSProviderType;
  rate: number;
  volume: number;
  errorMessage?: string;
}

// Inter-extension communication messages
export type ExtensionAction =
  | { type: 'READ_SELECTION'; text?: string }
  | { type: 'READ_PAGE' }
  | { type: 'PAUSE_PLAYBACK' }
  | { type: 'RESUME_PLAYBACK' }
  | { type: 'STOP_PLAYBACK' }
  | { type: 'SKIP_FORWARD' }
  | { type: 'SKIP_BACKWARD' }
  | { type: 'REPLAY_CHUNK' }
  | { type: 'SET_RATE'; rate: number }
  | { type: 'GET_PLAYER_STATUS' }
  | { type: 'PLAYER_STATUS_UPDATED'; status: PlayerStatus }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<UserSettings> }
  | { type: 'SETTINGS_UPDATED'; settings: UserSettings }
  | { type: 'TEST_GEMINI_CONNECTION'; apiKey: string; model?: string }
  | { type: 'TEST_GEMINI_RESULT'; success: boolean; message: string }
  | { type: 'COMPANION_CAPTURE_RECEIVED'; text: string; sourceApp?: string }
  | { type: 'CHECK_COMPANION_STATUS' };
