import { describe, expect, it } from 'vitest';
import {
  buildChoices,
  countDistinctAnswers,
  hasEnoughDistinctAnswersForMultipleChoice,
  InsufficientDistractorsError,
  REQUIRED_CHOICE_COUNT,
} from './build-choices.js';

function card(id: string, back: string) {
  return { id, back };
}

describe('countDistinctAnswers / hasEnoughDistinctAnswersForMultipleChoice', () => {
  it('counts distinct normalized answers, not raw rows', () => {
    const cards = [card('1', 'apple'), card('2', 'Apple'), card('3', ' apple '), card('4', 'cat')];
    expect(countDistinctAnswers(cards)).toBe(2);
  });

  it('is false when a 5-card set only has 3 distinct answers', () => {
    const cards = [card('1', 'a'), card('2', 'a'), card('3', 'b'), card('4', 'b'), card('5', 'c')];
    expect(hasEnoughDistinctAnswersForMultipleChoice(cards)).toBe(false);
  });

  it('is true once at least 4 distinct answers exist', () => {
    const cards = [card('1', 'a'), card('2', 'b'), card('3', 'c'), card('4', 'd')];
    expect(hasEnoughDistinctAnswersForMultipleChoice(cards)).toBe(true);
  });
});

describe('buildChoices', () => {
  const pool = [
    card('correct', 'quả táo'),
    card('d1', 'con mèo'),
    card('d2', 'chạy'),
    card('d3', 'trường học'),
    card('d4', 'quả táo'), // duplicate of the correct answer's text
  ];

  it('always returns exactly 4 choices, never 5 or more, never fewer', () => {
    const choices = buildChoices(pool[0], pool);
    expect(choices).toHaveLength(REQUIRED_CHOICE_COUNT);
  });

  it('contains exactly one correct answer and no duplicate choices', () => {
    const choices = buildChoices(pool[0], pool);
    expect(choices.filter((c) => c === 'quả táo')).toHaveLength(1);
    expect(new Set(choices).size).toBe(choices.length);
  });

  it('never includes another card whose answer duplicates the correct one', () => {
    for (let i = 0; i < 20; i++) {
      const choices = buildChoices(pool[0], pool);
      expect(choices.filter((c) => c === 'quả táo')).toHaveLength(1);
    }
  });

  it('does not always place the correct answer first (randomizes position)', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const choices = buildChoices(pool[0], pool);
      positions.add(choices.indexOf('quả táo'));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('throws InsufficientDistractorsError instead of fabricating or returning fewer than 4 choices', () => {
    const smallPool = [card('correct', 'apple'), card('d1', 'cat')];
    expect(() => buildChoices(smallPool[0], smallPool)).toThrow(InsufficientDistractorsError);
  });

  it('draws distractors only from the same set (i.e. only from what is passed in)', () => {
    const choices = buildChoices(pool[0], pool);
    const distractors = choices.filter((c) => c !== 'quả táo');
    for (const d of distractors) {
      expect(['con mèo', 'chạy', 'trường học']).toContain(d);
    }
  });
});
