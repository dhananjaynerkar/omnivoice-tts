/**
 * Normalizes mathematical formulas and expressions into natural spoken speech.
 */

const GREEK_SYMBOLS: Record<string, string> = {
  '\\alpha': 'alpha',
  '\\beta': 'beta',
  '\\gamma': 'gamma',
  '\\delta': 'delta',
  '\\epsilon': 'epsilon',
  '\\theta': 'theta',
  '\\lambda': 'lambda',
  '\\mu': 'mu',
  '\\pi': 'pi',
  '\\sigma': 'sigma',
  '\\omega': 'omega',
  'α': 'alpha',
  'β': 'beta',
  'γ': 'gamma',
  'δ': 'delta',
  'θ': 'theta',
  'λ': 'lambda',
  'μ': 'mu',
  'π': 'pi',
  'σ': 'sigma',
  'ω': 'omega'
};

const COMMON_FRACTIONS: Record<string, string> = {
  '1/2': 'one half',
  '1/3': 'one third',
  '2/3': 'two thirds',
  '1/4': 'one quarter',
  '3/4': 'three quarters',
  '1/5': 'one fifth',
  '2/5': 'two fifths',
  '3/5': 'three fifths',
  '4/5': 'four fifths'
};

export function normalizeMathExpression(text: string): string {
  if (!text) return '';

  let out = text;

  // Replace LaTeX \frac{a}{b} -> "a over b"
  out = out.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 over $2)');

  // Replace LaTeX \sqrt{x} -> "square root of x"
  out = out.replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1');
  out = out.replace(/sqrt\(([^)]+)\)/gi, 'square root of $1');

  // Replace common fractions if freestanding
  for (const [frac, spoken] of Object.entries(COMMON_FRACTIONS)) {
    const reg = new RegExp(`\\b${frac.replace('/', '\\/')}\\b`, 'g');
    out = out.replace(reg, spoken);
  }

  // Replace Greek symbols
  for (const [sym, spoken] of Object.entries(GREEK_SYMBOLS)) {
    out = out.split(sym).join(` ${spoken} `);
  }

  // Superscripts / powers: x^2 -> "x squared", x^3 -> "x cubed", x^n -> "x to the power of n"
  out = out.replace(/([a-zA-Z0-9)\]])\^2\b/g, '$1 squared');
  out = out.replace(/([a-zA-Z0-9)\]])\^3\b/g, '$1 cubed');
  out = out.replace(/([a-zA-Z0-9)\]])\^([a-zA-Z0-9]+)/g, '$1 to the power of $2');
  out = out.replace(/([a-zA-Z0-9)\]])\^\{([^}]+)\}/g, '$1 to the power of $2');

  // Subscripts: x_1 -> "x sub 1"
  out = out.replace(/([a-zA-Z])_([0-9a-zA-Z]+)/g, '$1 sub $2');
  out = out.replace(/([a-zA-Z])_\{([^}]+)\}/g, '$1 sub $2');

  // Mathematical comparison operators (ensure space separation)
  out = out.replace(/\s*!=\s*|\s*≠\s*/g, ' is not equal to ');
  out = out.replace(/\s*<=\s*|\s*≤\s*/g, ' is less than or equal to ');
  out = out.replace(/\s*>=\s*|\s*≥\s*/g, ' is greater than or equal to ');
  out = out.replace(/\s*==\s*|\s*=\s*/g, ' equals ');
  out = out.replace(/\s*<\s*/g, ' is less than ');
  out = out.replace(/\s*>\s*/g, ' is greater than ');

  // Standard arithmetic signs when used in mathematical expressions
  // e.g. "y = mx + c" -> "y equals m x plus c"
  out = out.replace(/([a-zA-Z0-9])\s*\+\s*([a-zA-Z0-9])/g, '$1 plus $2');
  out = out.replace(/([a-zA-Z0-9])\s*-\s*([a-zA-Z0-9])/g, '$1 minus $2');
  out = out.replace(/([a-zA-Z0-9])\s*\*\s*([a-zA-Z0-9])/g, '$1 times $2');
  out = out.replace(/([a-zA-Z0-9])\s*×\s*([a-zA-Z0-9])/g, '$1 times $2');
  out = out.replace(/([a-zA-Z0-9])\s*÷\s*([a-zA-Z0-9])/g, '$1 divided by $2');

  // Clean duplicate spaces
  return out.replace(/\s{2,}/g, ' ').trim();
}
