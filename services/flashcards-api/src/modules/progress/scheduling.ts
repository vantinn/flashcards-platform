import { CardRating } from './card-rating.enum.js';
import { ProgressStatus } from './entities/study-progress.entity.js';

/**
 * A deliberately simple, deterministic scheduler — not full SM-2 (no
 * per-card ease factor to tune). Each rating maps to a fixed repetitions
 * delta, and the interval is read off a fixed table by repetitions count.
 * That's enough to make "basic spaced repetition" reliable and easy to
 * reason about: given the same (repetitions, rating) pair you always get
 * the same (repetitions, intervalDays, status) out, with no hidden state.
 */
export const MASTERY_REPETITIONS = 3;

// Index = repetitions after this answer, capped at the last entry.
const INTERVAL_DAYS_BY_REPETITIONS = [0, 1, 3, 7, 14, 30, 60];

export interface SchedulingResult {
  repetitions: number;
  intervalDays: number;
  status: ProgressStatus;
  /** Whether this rating counts as a successful recall, for accuracy stats. */
  correct: boolean;
}

/**
 * - AGAIN resets the card to the front of the queue (0 repetitions, due now).
 * - HARD holds the current repetitions level (same interval next time).
 * - GOOD advances one step.
 * - EASY skips ahead two steps, rewarding an easy recall with a longer gap.
 */
export function scheduleNextReview(currentRepetitions: number, rating: CardRating): SchedulingResult {
  const repetitions = Math.max(0, nextRepetitions(currentRepetitions, rating));
  const intervalDays = INTERVAL_DAYS_BY_REPETITIONS[Math.min(repetitions, INTERVAL_DAYS_BY_REPETITIONS.length - 1)];
  const status = repetitions >= MASTERY_REPETITIONS ? ProgressStatus.MASTERED : ProgressStatus.LEARNING;
  return { repetitions, intervalDays, status, correct: rating !== CardRating.AGAIN };
}

function nextRepetitions(current: number, rating: CardRating): number {
  switch (rating) {
    case CardRating.AGAIN:
      return 0;
    case CardRating.HARD:
      return current;
    case CardRating.GOOD:
      return current + 1;
    case CardRating.EASY:
      return current + 2;
  }
}

export function addDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}
