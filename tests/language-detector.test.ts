import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../extension/utils/language-detector.ts';

describe('Language Detector Utility', () => {
  it('should detect English text correctly', () => {
    const text = 'This is an article explaining modern browser extensions and accessibility APIs.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('en');
  });

  it('should detect Hindi text correctly', () => {
    const text = 'यह एक बहुत ही उपयोगी टेक्स्ट टू स्पीच ब्राउज़र एक्सटेंशन है जो किसी भी टेक्स्ट को पढ़ सकता है।';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('hi');
  });

  it('should detect Marathi text with Marathi-specific markers', () => {
    const text = 'मराठी भाषा ही भारताच्या महाराष्ट्र राज्यातील प्रमुख भाषा आहे आणि ती खूप समृद्ध आहे.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('mr');
  });

  it('should detect Marathi text containing the Marathi ळ letter', () => {
    const text = 'बाळ आणि खेळणी अतिशय सुंदर आहेत.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('mr');
  });
});
