import { TTSProvider, TTSPlaybackOptions } from './tts-provider.ts';
import { VoiceInfo, TextChunk, AIMode } from '../../shared/types.ts';
import { buildProtectedPrompt } from '../utils/security.ts';
import { BrowserTTSProvider } from './browser-tts.ts';

export class GoogleGeminiTTSProvider implements TTSProvider {
  readonly id = 'google';
  readonly name = 'Google AI (Gemini + Voice)';
  readonly isLocal = false;

  private apiKey: string;
  private model: string;
  private aiMode: AIMode;
  private targetLanguage: string;
  private fallbackVoiceProvider: BrowserTTSProvider;

  constructor(
    apiKey = '',
    model = 'gemini-1.5-flash',
    aiMode: AIMode = 'natural',
    targetLanguage = 'en'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.aiMode = aiMode;
    this.targetLanguage = targetLanguage;
    this.fallbackVoiceProvider = new BrowserTTSProvider();
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setModel(model: string): void {
    this.model = model;
  }

  setAIMode(mode: AIMode): void {
    this.aiMode = mode;
  }

  setTargetLanguage(lang: string): void {
    this.targetLanguage = lang;
  }

  async initialize(): Promise<void> {
    await this.fallbackVoiceProvider.initialize();
  }

  async getVoices(): Promise<VoiceInfo[]> {
    // Uses high quality voices from browser or cloud representation
    const nativeVoices = await this.fallbackVoiceProvider.getVoices();
    return nativeVoices.map(v => ({
      ...v,
      provider: 'google'
    }));
  }

  supports(language: string): boolean {
    return true; // Gemini supports multilingual text processing
  }

  supportsStreaming(): boolean {
    return false;
  }

  /**
   * Tests API key validity against Google AI Studio Gemini endpoint
   */
  static async testConnection(apiKey: string, model = 'gemini-1.5-flash'): Promise<{ success: boolean; message: string }> {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, message: 'API key is empty' };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping test. Reply with: OK' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return { success: false, message: `Gemini API Error: ${errMsg}` };
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        return { success: true, message: 'Successfully connected to Google AI Studio!' };
      }

      return { success: false, message: 'Invalid response format from Gemini API' };
    } catch (err) {
      return { success: false, message: `Network/Connection error: ${(err as Error).message}` };
    }
  }

  /**
   * Processes untrusted text with Gemini using strict prompt injection defense
   */
  async processWithGemini(rawText: string, mode: AIMode): Promise<string> {
    if (!this.apiKey) {
      console.warn('No Gemini API key provided, reading raw text.');
      return rawText;
    }

    if (mode === 'direct') {
      return rawText;
    }

    const { systemInstruction, contents } = buildProtectedPrompt(
      mode,
      rawText,
      this.targetLanguage
    );

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey.trim())}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: contents }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        })
      });

      if (!response.ok) {
        console.warn(`Gemini processing failed (${response.status}), falling back to direct text`);
        return rawText;
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText && candidateText.trim()) {
        return candidateText.trim();
      }

      return rawText;
    } catch (err) {
      console.warn('Error during Gemini API call, falling back to direct text:', err);
      return rawText;
    }
  }

  async speak(chunk: TextChunk, options: TTSPlaybackOptions = {}): Promise<void> {
    let textToSpeak = chunk.text;

    // Apply AI processing if enabled
    if (this.aiMode !== 'direct' && this.apiKey) {
      try {
        textToSpeak = await this.processWithGemini(chunk.rawText || chunk.text, this.aiMode);
      } catch {
        textToSpeak = chunk.text;
      }
    }

    // Synthesize using speech engine with updated text
    const processedChunk: TextChunk = {
      ...chunk,
      text: textToSpeak
    };

    await this.fallbackVoiceProvider.speak(processedChunk, options);
  }

  pause(): void {
    this.fallbackVoiceProvider.pause();
  }

  resume(): void {
    this.fallbackVoiceProvider.resume();
  }

  stop(): void {
    this.fallbackVoiceProvider.stop();
  }
}
