import { describe, it, expect } from 'vitest';
import {
  normalizeTextForSpeech,
  normalizeUrl,
  normalizeLists,
  handleCodeBlocks
} from '../extension/utils/text-normalizer.ts';

describe('Text Normalizer Utility', () => {
  it('should normalize long URLs into natural spoken descriptions', () => {
    const url = 'https://example.com/articles/artificial-intelligence';
    const spoken = normalizeUrl(url);
    expect(spoken).toContain('example dot com');
    expect(spoken).toContain('articles');
    expect(spoken).toContain('artificial intelligence');
  });

  it('should normalize numbered and bulleted lists', () => {
    const listText = '1. Python\n2. Java\n3. C++';
    const normalized = normalizeLists(listText);
    expect(normalized).toContain('Number one, Python');
    expect(normalized).toContain('Number two, Java');
    expect(normalized).toContain('Number three, C++');

    const bulletText = '- Apples\n- Oranges';
    const bulletNorm = normalizeLists(bulletText);
    expect(bulletNorm).toContain('Item: Apples');
    expect(bulletNorm).toContain('Item: Oranges');
  });

  it('should handle code blocks according to mode', () => {
    const textWithCode = 'Here is code: ```python\nprint("Hello")\n``` and more text.';

    const skipResult = handleCodeBlocks(textWithCode, 'skip');
    expect(skipResult.processedText).toContain('[code skipped]');

    const readResult = handleCodeBlocks(textWithCode, 'read');
    expect(readResult.processedText).toContain('Code snippet:');
    expect(readResult.codeBlocks.length).toBe(1);
  });

  it('should expand common acronyms and technical abbreviations', () => {
    const input = 'This AI tool has a powerful API for UI design, e.g., buttons and icons.';
    const output = normalizeTextForSpeech(input);
    expect(output).toContain('A I');
    expect(output).toContain('A P I');
    expect(output).toContain('U I');
    expect(output).toContain('for example,');
  });
});
