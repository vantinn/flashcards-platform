import { normalizeAnswer } from './normalize-answer.js';

export const REQUIRED_CHOICE_COUNT = 4;
export const REQUIRED_DISTRACTOR_COUNT = REQUIRED_CHOICE_COUNT - 1;

export interface AnswerCandidate {
  id: string;
  back: string;
}

export class InsufficientDistractorsError extends Error {
  constructor() {
    super('Not enough distinct answers in this set to build a 4-choice question');
    this.name = 'InsufficientDistractorsError';
  }
}

/** Count of distinct (normalized) answer values across a set's cards. */
export function countDistinctAnswers(cards: AnswerCandidate[]): number {
  return new Set(cards.map((card) => normalizeAnswer(card.back))).size;
}

/**
 * Every Cram question and every Deep Learning multiple-choice question
 * must have exactly 4 choices — 1 correct + 3 distractors, never more,
 * never fewer, never fabricated. Since a question's distractor pool
 * excludes only the correct card's own answer value, `distinct total >= 4`
 * guarantees every card in the set can always be given exactly 3 distinct
 * distractors. Callers (LearningService) must check this once when a
 * session starts and refuse to start the mode otherwise — this is not a
 * per-question fallback.
 */
export function hasEnoughDistinctAnswersForMultipleChoice(cards: AnswerCandidate[]): boolean {
  return countDistinctAnswers(cards) >= REQUIRED_CHOICE_COUNT;
}

/**
 * Builds exactly 4 shuffled choice strings for `correctCard`: its own
 * `back` plus 3 distractors sampled from other cards in `pool` (normally
 * the whole set, regardless of those cards' own progress in this session —
 * sampling only from incomplete cards would starve distractors late in a
 * session) whose `back` differs from the correct answer and from each
 * other. Throws if fewer than 3 usable distractors exist — callers must
 * have already gated session start on
 * hasEnoughDistinctAnswersForMultipleChoice(), so this should never be
 * reachable in normal operation; it exists as a defensive guard, not a
 * silent short-choice fallback.
 */
export function buildChoices(correctCard: AnswerCandidate, pool: AnswerCandidate[]): string[] {
  const correctNormalized = normalizeAnswer(correctCard.back);

  const distractorTextByNormalized = new Map<string, string>();
  for (const card of pool) {
    if (card.id === correctCard.id) continue;
    const normalized = normalizeAnswer(card.back);
    if (normalized === correctNormalized) continue;
    if (!distractorTextByNormalized.has(normalized)) {
      distractorTextByNormalized.set(normalized, card.back);
    }
  }

  const distractorCandidates = [...distractorTextByNormalized.values()];
  if (distractorCandidates.length < REQUIRED_DISTRACTOR_COUNT) {
    throw new InsufficientDistractorsError();
  }

  const distractors = shuffle(distractorCandidates).slice(0, REQUIRED_DISTRACTOR_COUNT);
  return shuffle([correctCard.back, ...distractors]);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
