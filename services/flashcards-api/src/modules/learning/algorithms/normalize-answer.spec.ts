import { describe, expect, it } from 'vitest';
import { normalizeAnswer } from './normalize-answer.js';

describe('normalizeAnswer', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeAnswer('  apple  ')).toBe('apple');
  });

  it('collapses repeated internal whitespace to a single space', () => {
    expect(normalizeAnswer('quả   táo')).toBe('quả táo');
  });

  it('is case-insensitive', () => {
    expect(normalizeAnswer('Apple')).toBe(normalizeAnswer('apple'));
  });

  it('does not fuzzy-match different words', () => {
    expect(normalizeAnswer('apple')).not.toBe(normalizeAnswer('appl'));
  });
});
