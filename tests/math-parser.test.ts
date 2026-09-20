import { describe, it, expect } from 'vitest';
import { normalizeMathExpression } from '../extension/utils/math-parser.ts';

describe('Math Parser Utility', () => {
  it('should normalize y = mx + c to spoken language', () => {
    const expr = 'y = mx + c';
    const spoken = normalizeMathExpression(expr);
    expect(spoken).toContain('y equals');
    expect(spoken).toContain('plus');
  });

  it('should handle powers and exponents', () => {
    expect(normalizeMathExpression('x^2')).toBe('x squared');
    expect(normalizeMathExpression('x^3')).toBe('x cubed');
    expect(normalizeMathExpression('x^n')).toBe('x to the power of n');
  });

  it('should handle fractions and LaTeX fractions', () => {
    expect(normalizeMathExpression('1/2')).toBe('one half');
    expect(normalizeMathExpression('3/4')).toBe('three quarters');
    expect(normalizeMathExpression('\\frac{a}{b}')).toBe('(a over b)');
  });

  it('should handle Greek symbols and square roots', () => {
    const res = normalizeMathExpression('2 * \\pi * r');
    expect(res).toContain('pi');
    expect(normalizeMathExpression('\\sqrt{x}')).toBe('square root of x');
  });

  it('should normalize comparison operators', () => {
    expect(normalizeMathExpression('a != b')).toBe('a is not equal to b');
    expect(normalizeMathExpression('x <= 10')).toBe('x is less than or equal to 10');
    expect(normalizeMathExpression('x >= 5')).toBe('x is greater than or equal to 5');
  });
});
