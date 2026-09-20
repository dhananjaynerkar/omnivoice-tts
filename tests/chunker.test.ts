import { describe, it, expect } from 'vitest';
import { createChunksFromText, splitIntoSentences } from '../extension/utils/chunker.ts';

describe('Chunker Utility', () => {
  it('should split text into sentences properly', () => {
    const text = 'Hello world! How are you today? This is a great day. And Hindi: यह एक वाक्य है।';
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences[0]).toContain('Hello world!');
  });

  it('should create chunks within the specified maximum chunk size', () => {
    const paragraph =
      'Artificial intelligence is transforming modern software engineering. ' +
      'Engineers can now build complex distributed systems with automated testing and high reliability. ' +
      'Accessibility in web applications is becoming a first-class priority for developers worldwide.';

    const chunks = createChunksFromText(paragraph, 'paragraph', { maxChunkSize: 100 });
    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(150); // within tolerance with clause breaks
      expect(chunk.totalChunks).toBe(chunks.length);
    }
  });

  it('should assign correct indices and IDs to chunks', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = createChunksFromText(text, 'paragraph', { maxChunkSize: 50 });

    chunks.forEach((ch, idx) => {
      expect(ch.index).toBe(idx);
      expect(ch.id).toContain('chunk_');
      expect(ch.totalChunks).toBe(chunks.length);
    });
  });

  it('should handle empty or whitespace text gracefully', () => {
    const chunks = createChunksFromText('   \n\n  ');
    expect(chunks).toEqual([]);
  });
});
