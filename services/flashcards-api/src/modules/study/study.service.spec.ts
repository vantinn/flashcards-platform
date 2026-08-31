import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudyService, computeStreakFromDays } from './study.service.js';
import { StudySession } from './entities/study-session.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import { FlashcardsService } from '../flashcards/flashcards.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { CardRating } from '../progress/card-rating.enum.js';

/** A minimal fluent mock matching the subset of TypeORM's SelectQueryBuilder used here — every chain method returns itself. */
function fluentQueryBuilder(getRawOneValue: unknown, getRawManyValue: unknown[] = []) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'where', 'andWhere', 'orderBy', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.getRawOne = vi.fn().mockResolvedValue(getRawOneValue);
  builder.getRawMany = vi.fn().mockResolvedValue(getRawManyValue);
  return builder;
}

describe('StudyService', () => {
  let service: StudyService;
  let repo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let flashcardSetsService: { findOneVisibleTo: ReturnType<typeof vi.fn>; incrementStudyCount: ReturnType<typeof vi.fn> };
  let flashcardsService: { findBySet: ReturnType<typeof vi.fn> };
  let progressService: { recordAnswers: ReturnType<typeof vi.fn> };

  const setCards = [{ id: 'card-1' }, { id: 'card-2' }, { id: 'card-3' }];

  beforeEach(async () => {
    repo = {
      create: vi.fn((input) => input),
      save: vi.fn((entity) => Promise.resolve({ id: 'session-1', ...entity })),
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(),
    };
    flashcardSetsService = {
      findOneVisibleTo: vi.fn(),
      incrementStudyCount: vi.fn(),
    };
    flashcardsService = {
      findBySet: vi.fn().mockResolvedValue(setCards),
    };
    progressService = { recordAnswers: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StudyService,
        { provide: getRepositoryToken(StudySession), useValue: repo },
        { provide: FlashcardSetsService, useValue: flashcardSetsService },
        { provide: FlashcardsService, useValue: flashcardsService },
        { provide: ProgressService, useValue: progressService },
      ],
    }).compile();

    service = moduleRef.get(StudyService);
  });

  describe('start', () => {
    it('rejects studying a set that is not visible to the caller', async () => {
      flashcardSetsService.findOneVisibleTo.mockRejectedValue(new NotFoundException());
      await expect(service.start('user-1', 'set-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a session once visibility is confirmed', async () => {
      flashcardSetsService.findOneVisibleTo.mockResolvedValue({ id: 'set-1' });
      const session = await service.start('user-1', 'set-1');
      expect(session.id).toBe('session-1');
    });
  });

  describe('complete', () => {
    it('rejects completing another user\'s session', async () => {
      repo.findOne.mockResolvedValue({
        id: 'session-1',
        user: { id: 'someone-else' },
        set: { id: 'set-1' },
      });

      await expect(
        service.complete('session-1', 'user-1', { results: [{ flashcardId: 'card-1', rating: CardRating.GOOD }] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when none of the submitted flashcardIds belong to the session\'s set', async () => {
      repo.findOne.mockResolvedValue({
        id: 'session-1',
        user: { id: 'user-1' },
        set: { id: 'set-1' },
      });

      await expect(
        service.complete('session-1', 'user-1', {
          results: [{ flashcardId: 'card-from-another-set', rating: CardRating.GOOD }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(progressService.recordAnswers).not.toHaveBeenCalled();
    });

    it('silently drops a flashcardId that no longer belongs to the set (e.g. deleted mid-session) but keeps the rest', async () => {
      repo.findOne.mockResolvedValue({
        id: 'session-1',
        user: { id: 'user-1' },
        set: { id: 'set-1' },
      });

      const result = await service.complete('session-1', 'user-1', {
        results: [
          { flashcardId: 'card-1', rating: CardRating.GOOD },
          { flashcardId: 'card-deleted', rating: CardRating.GOOD },
        ],
      });

      expect(result.cardsStudied).toBe(1);
      expect(progressService.recordAnswers).toHaveBeenCalledWith('user-1', [{ flashcardId: 'card-1', rating: CardRating.GOOD }]);
    });

    it('derives aggregates from the results and records progress per card', async () => {
      repo.findOne.mockResolvedValue({
        id: 'session-1',
        user: { id: 'user-1' },
        set: { id: 'set-1' },
      });

      const result = await service.complete('session-1', 'user-1', {
        results: [
          { flashcardId: 'card-1', rating: CardRating.GOOD },
          { flashcardId: 'card-2', rating: CardRating.AGAIN },
          { flashcardId: 'card-3', rating: CardRating.EASY },
        ],
      });

      expect(result.cardsStudied).toBe(3);
      expect(result.correctCount).toBe(2);
      expect(result.incorrectCount).toBe(1);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(progressService.recordAnswers).toHaveBeenCalledTimes(1);
      expect(progressService.recordAnswers).toHaveBeenCalledWith('user-1', [
        { flashcardId: 'card-1', rating: CardRating.GOOD },
        { flashcardId: 'card-2', rating: CardRating.AGAIN },
        { flashcardId: 'card-3', rating: CardRating.EASY },
      ]);
      expect(flashcardSetsService.incrementStudyCount).toHaveBeenCalledWith('set-1');
    });
  });

  describe('findHistoryForUser', () => {
    it('defaults to a bounded page size', async () => {
      await service.findHistoryForUser('user-1');
      const [options] = repo.find.mock.calls[0];
      expect(options.take).toBe(20);
    });

    it('honors an explicit limit', async () => {
      await service.findHistoryForUser('user-1', 5);
      const [options] = repo.find.mock.calls[0];
      expect(options.take).toBe(5);
    });
  });

  describe('getStats', () => {
    it('combines the streak (from distinct studied days) with today\'s review sum', async () => {
      const daysBuilder = fluentQueryBuilder(undefined, [{ day: '2026-08-31' }, { day: '2026-08-30' }]);
      const reviewsTodayBuilder = fluentQueryBuilder({ total: '7' });
      repo.createQueryBuilder.mockReturnValueOnce(daysBuilder).mockReturnValueOnce(reviewsTodayBuilder);

      const stats = await service.getStats('user-1');

      expect(stats.reviewsToday).toBe(7);
      expect(stats.streakDays).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('computeStreakFromDays', () => {
  function isoDaysAgo(days: number): string {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }

  it('is 0 with no studied days', () => {
    expect(computeStreakFromDays([])).toBe(0);
  });

  it('counts today, yesterday, etc. as long as they are consecutive', () => {
    expect(computeStreakFromDays([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)])).toBe(3);
  });

  it('stops counting at the first gap', () => {
    expect(computeStreakFromDays([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(3)])).toBe(2);
  });

  it('still counts a streak ending yesterday if nothing has been studied yet today', () => {
    expect(computeStreakFromDays([isoDaysAgo(1), isoDaysAgo(2)])).toBe(2);
  });

  it('is 0 if the most recent studied day was before yesterday', () => {
    expect(computeStreakFromDays([isoDaysAgo(3), isoDaysAgo(4)])).toBe(0);
  });
});
