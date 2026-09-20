/**
 * Language detector with specific emphasis on English, Hindi, and Marathi
 */

export interface DetectedLanguage {
  code: string; // 'en', 'hi', 'mr', or ISO code
  name: string;
  confidence: number;
}

const MARATHI_MARKERS = [
  'आहे', 'नाही', 'आहेत', 'करणार', 'करतो', 'करते', 'झाला', 'झाली', 'झाले',
  'काय', 'कसे', 'कुठे', 'आणि', 'पण', 'तर', 'म्हणून', 'इत्यादी', 'त्यांच्या', 'आपण'
];

const HINDI_MARKERS = [
  'है', 'हैं', 'नहीं', 'करना', 'करता', 'करती', 'हुआ', 'हुई', 'हुए',
  'क्या', 'कैसे', 'कहाँ', 'और', 'लेकिन', 'तो', 'इसलिए', 'इत्यादि', 'उनके', 'हम'
];

export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) {
    return { code: 'en', name: 'English', confidence: 1.0 };
  }

  const sample = text.slice(0, 500);

  // Check for Devanagari script (\u0900-\u097F)
  const devanagariMatches = sample.match(/[\u0900-\u097F]/g);
  const totalChars = sample.replace(/\s+/g, '').length;

  if (devanagariMatches && devanagariMatches.length / totalChars > 0.3) {
    // Specifically check for Marathi letter LLA: ळ (\u0933)
    if (/ळ/.test(sample)) {
      return { code: 'mr', name: 'Marathi', confidence: 0.95 };
    }

    // Check words against markers
    let mrScore = 0;
    let hiScore = 0;
    const words = sample.split(/\s+/);

    for (const w of words) {
      if (MARATHI_MARKERS.includes(w)) mrScore++;
      if (HINDI_MARKERS.includes(w)) hiScore++;
    }

    if (mrScore > hiScore) {
      return { code: 'mr', name: 'Marathi', confidence: 0.85 };
    } else if (hiScore > 0 || devanagariMatches.length > 0) {
      return { code: 'hi', name: 'Hindi', confidence: 0.85 };
    }
  }

  // Default to English
  return { code: 'en', name: 'English', confidence: 0.9 };
}
