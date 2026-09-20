import { normalizeMathExpression } from './math-parser.ts';
import { CodeHandlingMode } from '../../shared/types.ts';

/**
 * Normalizes long or complex URLs into human-friendly spoken descriptions
 * e.g., "https://example.com/articles/artificial-intelligence" ->
 * "Link: example dot com, articles, artificial intelligence"
 */
export function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const domain = url.hostname.replace(/^www\./, '').replace(/\./g, ' dot ');
    const pathParts = url.pathname
      .split('/')
      .filter(p => p && p.length > 0)
      .map(p => decodeURIComponent(p).replace(/[-_]/g, ' '));

    if (pathParts.length === 0) {
      return `Link to ${domain}`;
    }

    return `Link: ${domain}, ${pathParts.join(', ')}`;
  } catch {
    // If not a valid standard URL, return a simplified spoken form
    return urlStr
      .replace(/^https?:\/\//, '')
      .replace(/\./g, ' dot ')
      .replace(/\//g, ', ');
  }
}

/**
 * Normalizes numbered and bulleted lists for spoken narration
 * e.g. "1. Python\n2. Java" -> "Number one, Python. Number two, Java."
 */
export function normalizeLists(text: string): string {
  let out = text;

  // Numbered list items at line starts or sentence boundaries
  // e.g., "1. Python" or "\n 2) Java"
  const numberWordMap: Record<string, string> = {
    '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
    '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten'
  };

  out = out.replace(/(?:^|\n)\s*(\d{1,2})[\.\)]\s+([^\n]+)/g, (_, num, item) => {
    const spokenNum = numberWordMap[num] || num;
    return `\nNumber ${spokenNum}, ${item.trim()}.\n`;
  });

  // Bullet items (-, *, •, ▪)
  out = out.replace(/(?:^|\n)\s*[-*•▪]\s+([^\n]+)/g, (_, item) => {
    return `\nItem: ${item.trim()}.\n`;
  });

  return out;
}

/**
 * Formats code blocks according to user preference
 */
export function handleCodeBlocks(
  text: string,
  mode: CodeHandlingMode
): { processedText: string; codeBlocks: string[] } {
  const codeBlocks: string[] = [];
  const codeRegex = /```[\w]*\n?([\s\S]*?)```|`([^`]+)`/g;

  if (mode === 'skip') {
    const processed = text.replace(codeRegex, () => ' [code skipped] ');
    return { processedText: processed, codeBlocks };
  }

  if (mode === 'read') {
    // Read code as syntax
    const processed = text.replace(codeRegex, (match, block, inline) => {
      const code = (block || inline || '').trim();
      codeBlocks.push(code);
      return ` Code snippet: ${code} End of code. `;
    });
    return { processedText: processed, codeBlocks };
  }

  // explain mode: placeholder to be enriched by AI if key available
  const processed = text.replace(codeRegex, (match, block, inline) => {
    const code = (block || inline || '').trim();
    codeBlocks.push(code);
    return ` [Code block: ${code.slice(0, 80)}...] `;
  });

  return { processedText: processed, codeBlocks };
}

export interface NormalizationOptions {
  codeHandling?: CodeHandlingMode;
  mathNormalization?: boolean;
  urlNormalization?: boolean;
  listNormalization?: boolean;
}

/**
 * Comprehensive text normalizer for spoken TTS output
 */
export function normalizeTextForSpeech(
  rawText: string,
  options: NormalizationOptions = {}
): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Handle Code blocks
  if (options.codeHandling) {
    const { processedText } = handleCodeBlocks(text, options.codeHandling);
    text = processedText;
  }

  // 2. URLs to spoken form
  if (options.urlNormalization !== false) {
    text = text.replace(/https?:\/\/[^\s<>"{}|\\^`\]]+/gi, (matchedUrl) => {
      return normalizeUrl(matchedUrl);
    });
  }

  // 3. Lists
  if (options.listNormalization !== false) {
    text = normalizeLists(text);
  }

  // 4. Mathematical formulas
  if (options.mathNormalization !== false) {
    text = normalizeMathExpression(text);
  }

  // 5. Common abbreviations and acronyms
  text = text
    .replace(/\bAI\b/g, 'A I')
    .replace(/\bAPI\b/g, 'A P I')
    .replace(/\bAPIs\b/g, 'A P Is')
    .replace(/\bUI\b/g, 'U I')
    .replace(/\bUX\b/g, 'U X')
    .replace(/\bURL\b/g, 'U R L')
    .replace(/\bURLs\b/g, 'U R Ls')
    .replace(/\bHTML\b/g, 'H T M L')
    .replace(/\bCSS\b/g, 'C S S')
    .replace(/\bJS\b/g, 'JavaScript')
    .replace(/\bTS\b/g, 'TypeScript')
    .replace(/\be\.g\.,?/gi, 'for example,')
    .replace(/\bi\.e\.,?/gi, 'that is,')
    .replace(/\betc\./gi, 'etcetera')
    .replace(/\bvs\./gi, 'versus')
    .replace(/\bDr\.\s/g, 'Doctor ')
    .replace(/\bMr\.\s/g, 'Mister ')
    .replace(/\bMrs\.\s/g, 'Missus ')
    .replace(/\bMs\.\s/g, 'Miz ')
    .replace(/\bProf\.\s/g, 'Professor ');

  // 6. Natural pause on em-dashes and parentheses
  text = text.replace(/—/g, ', ');
  text = text.replace(/–/g, ', ');

  // 7. Clean up redundant spaces and empty lines
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return text;
}
