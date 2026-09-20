/**
 * Protocol definition for communication between Chrome Extension and Desktop Companion
 * Uses secure localhost WebSocket with token-based handshake.
 */

export const DEFAULT_COMPANION_PORT = 8765;
export const DEFAULT_COMPANION_HOST = '127.0.0.1';

export type CompanionMessageType =
  | 'AUTH_REQUEST'
  | 'AUTH_RESPONSE'
  | 'TEXT_CAPTURED'
  | 'SPEAK_REQUEST'
  | 'SPEAK_PROGRESS'
  | 'SPEAK_COMPLETE'
  | 'PAUSE_REQUEST'
  | 'RESUME_REQUEST'
  | 'STOP_REQUEST'
  | 'GET_STATUS'
  | 'STATUS_RESPONSE'
  | 'GET_VOICES'
  | 'VOICES_RESPONSE'
  | 'ERROR';

export interface CompanionMessage<T = unknown> {
  type: CompanionMessageType;
  token?: string;
  requestId?: string;
  payload: T;
  timestamp: number;
}

export interface AuthRequestPayload {
  token: string;
  clientVersion: string;
  origin: string;
}

export interface AuthResponsePayload {
  authenticated: boolean;
  serverVersion: string;
  system: string; // e.g. "Windows 11"
  features: string[]; // ["clipboard", "uiautomation", "sapi5_tts"]
  message?: string;
}

export interface TextCapturedPayload {
  text: string;
  sourceApp?: string; // e.g. "Code.exe", "notepad.exe"
  captureMethod: 'ui_automation' | 'clipboard_fallback';
}

export interface SpeakRequestPayload {
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface CompanionVoice {
  id: string;
  name: string;
  languages: string[];
  gender?: string;
}
