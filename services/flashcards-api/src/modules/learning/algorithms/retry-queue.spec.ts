import { describe, expect, it } from 'vitest';
import {
  dueSequenceAfterMultipleChoicePass,
  dueSequenceAfterWrongAnswer,
  pickNextCard,
  RETRY_GAP,
  STAGE_ADVANCE_GAP,
  type PendingCardState,
} from './retry-queue.js';

function state(id: string, dueSequence: number, attempts = 0, position = 0): PendingCardState {
  return { flashcardId: id, dueSequence, attempts, flashcardPosition: position };
}

describe('pickNextCard', () => {
  it('returns null once there are no pending cards (mode complete)', () => {
    expect(pickNextCard([], 0)).toBeNull();
  });

  it('prefers a card whose cool-down has elapsed over one still due later', () => {
    const pending = [state('late', 10), state('ready', 2)];
    expect(pickNextCard(pending, 5)?.flashcardId).toBe('ready');
  });

  it('falls back to the whole pending pool when every card is mid-cooldown, instead of stalling', () => {
    const pending = [state('a', 10), state('b', 8)];
    const picked = pickNextCard(pending, 0);
    expect(picked).not.toBeNull();
    expect(['a', 'b']).toContain(picked!.flashcardId);
  });

  it('picks the lowest dueSequence among mid-cooldown cards as the fallback', () => {
    const pending = [state('a', 10), state('b', 8)];
    expect(pickNextCard(pending, 0)?.flashcardId).toBe('b');
  });

  it('is fully deterministic given the same input (no randomness in card selection)', () => {
    const pending = [state('a', 3, 1, 2), state('b', 3, 1, 1)];
    const results = new Set(Array.from({ length: 20 }, () => pickNextCard(pending, 3)?.flashcardId));
    expect(results.size).toBe(1);
  });

  it('tie-breaks by attempts, then by flashcard position', () => {
    const pending = [state('more-attempts', 0, 5, 0), state('fewer-attempts', 0, 1, 1)];
    expect(pickNextCard(pending, 0)?.flashcardId).toBe('fewer-attempts');

    const tiedAttempts = [state('later-position', 0, 1, 5), state('earlier-position', 0, 1, 1)];
    expect(pickNextCard(tiedAttempts, 0)?.flashcardId).toBe('earlier-position');
  });

  it('a 1-card pending pool re-serves the same card immediately after a wrong answer (accepted, not a bug)', () => {
    const sequence = 0;
    const dueAfterWrong = dueSequenceAfterWrongAnswer(sequence);
    const pending = [state('only-card', dueAfterWrong)];
    expect(pickNextCard(pending, sequence)?.flashcardId).toBe('only-card');
  });
});

describe('due-sequence helpers', () => {
  it('bumps due sequence by RETRY_GAP on a wrong answer', () => {
    expect(dueSequenceAfterWrongAnswer(5)).toBe(5 + RETRY_GAP);
  });

  it('bumps due sequence by STAGE_ADVANCE_GAP after a multiple-choice pass', () => {
    expect(dueSequenceAfterMultipleChoicePass(5)).toBe(5 + STAGE_ADVANCE_GAP);
  });

  it('a card does not immediately reappear when other cards exist (RETRY_GAP > 0)', () => {
    const sequence = 10;
    const due = dueSequenceAfterWrongAnswer(sequence);
    const pending = [state('just-wrong', due), state('other', sequence)];
    expect(pickNextCard(pending, sequence)?.flashcardId).toBe('other');
  });
});
