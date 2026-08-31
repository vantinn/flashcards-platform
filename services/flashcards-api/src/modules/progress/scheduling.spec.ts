import { describe, it, expect } from 'vitest';
import { scheduleNextReview, addDays, MASTERY_REPETITIONS } from './scheduling.js';
import { CardRating } from './card-rating.enum.js';
import { ProgressStatus } from './entities/study-progress.entity.js';

describe('scheduleNextReview', () => {
  it('is a pure function of (repetitions, rating) — same input always yields the same output', () => {
    expect(scheduleNextReview(1, CardRating.GOOD)).toEqual(scheduleNextReview(1, CardRating.GOOD));
  });

  it('AGAIN always resets repetitions to 0 and interval to 0, regardless of prior progress', () => {
    for (const repetitions of [0, 1, 2, 5, 20]) {
      const result = scheduleNextReview(repetitions, CardRating.AGAIN);
      expect(result.repetitions).toBe(0);
      expect(result.intervalDays).toBe(0);
      expect(result.status).toBe(ProgressStatus.LEARNING);
      expect(result.correct).toBe(false);
    }
  });

  it('HARD holds the current repetitions level (same interval next time)', () => {
    const result = scheduleNextReview(2, CardRating.HARD);
    expect(result.repetitions).toBe(2);
    expect(result.correct).toBe(true);
  });

  it('GOOD advances repetitions by one step', () => {
    const result = scheduleNextReview(1, CardRating.GOOD);
    expect(result.repetitions).toBe(2);
    expect(result.correct).toBe(true);
  });

  it('EASY advances repetitions by two steps', () => {
    const result = scheduleNextReview(0, CardRating.EASY);
    expect(result.repetitions).toBe(2);
    expect(result.correct).toBe(true);
  });

  it('interval grows monotonically with repetitions', () => {
    let previousInterval = -1;
    let repetitions = 0;
    for (let i = 0; i < 6; i++) {
      const result = scheduleNextReview(repetitions, CardRating.GOOD);
      expect(result.intervalDays).toBeGreaterThanOrEqual(previousInterval);
      previousInterval = result.intervalDays;
      repetitions = result.repetitions;
    }
  });

  it('promotes to MASTERED once repetitions reach the mastery threshold', () => {
    const result = scheduleNextReview(MASTERY_REPETITIONS - 1, CardRating.GOOD);
    expect(result.repetitions).toBe(MASTERY_REPETITIONS);
    expect(result.status).toBe(ProgressStatus.MASTERED);
  });

  it('demotes a mastered card back to LEARNING on AGAIN', () => {
    const result = scheduleNextReview(MASTERY_REPETITIONS, CardRating.AGAIN);
    expect(result.status).toBe(ProgressStatus.LEARNING);
  });

  it('never returns negative repetitions', () => {
    for (const rating of Object.values(CardRating)) {
      expect(scheduleNextReview(0, rating).repetitions).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('addDays', () => {
  it('adds calendar days without mutating the input', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const result = addDays(from, 3);
    expect(result.toISOString()).toBe('2026-01-04T00:00:00.000Z');
    expect(from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('a 0-day interval returns the same instant (due immediately)', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(addDays(from, 0).getTime()).toBe(from.getTime());
  });
});
