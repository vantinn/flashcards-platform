import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressService } from './progress.service.js';
import { ProgressStatus, StudyProgress } from './entities/study-progress.entity.js';
import { CardRating } from './card-rating.enum.js';

/** A minimal fluent mock matching the subset of TypeORM's SelectQueryBuilder used here — every chain method returns itself. */
function fluentQueryBuilder(getRawOneValue: unknown, getRawManyValue: unknown[] = []) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'setParameters', 'innerJoin', 'groupBy', 'addGroupBy', 'orderBy', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.getRawOne = vi.fn().mockResolvedValue(getRawOneValue);
  builder.getRawMany = vi.fn().mockResolvedValue(getRawManyValue);
  return builder;
}

describe('ProgressService', () => {
  let service: ProgressService;
  let repo: {
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    manager: { transaction: ReturnType<typeof vi.fn> };
  };
  let transactionSave: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    transactionSave = vi.fn((entities) => Promise.resolve(entities));
    repo = {
      find: vi.fn(),
      create: vi.fn((input) => ({ correctCount: 0, incorrectCount: 0, ...input })),
      createQueryBuilder: vi.fn(),
      manager: {
        transaction: vi.fn((work: (manager: { save: typeof transactionSave }) => unknown) =>
          work({ save: transactionSave }),
        ),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ProgressService, { provide: getRepositoryToken(StudyProgress), useValue: repo }],
    }).compile();

    service = moduleRef.get(ProgressService);
  });

  it('creates a new progress row on the first answer', async () => {
    repo.find.mockResolvedValue([]);

    await service.recordAnswers('user-1', [{ flashcardId: 'card-1', rating: CardRating.GOOD }]);

    const [[entities]] = transactionSave.mock.calls;
    const [saved] = entities;
    expect(saved.correctCount).toBe(1);
    expect(saved.repetitions).toBe(1);
    expect(saved.status).toBe(ProgressStatus.LEARNING);
    expect(saved.nextReviewAt).toBeInstanceOf(Date);
  });

  it('promotes to mastered once repetitions reach the mastery threshold', async () => {
    repo.find.mockResolvedValue([
      { flashcard: { id: 'card-1' }, correctCount: 2, incorrectCount: 0, repetitions: 2, status: ProgressStatus.LEARNING },
    ]);

    await service.recordAnswers('user-1', [{ flashcardId: 'card-1', rating: CardRating.GOOD }]);

    const [[entities]] = transactionSave.mock.calls;
    const [saved] = entities;
    expect(saved.correctCount).toBe(3);
    expect(saved.repetitions).toBe(3);
    expect(saved.status).toBe(ProgressStatus.MASTERED);
  });

  it('demotes a mastered card back to learning and resets its interval on AGAIN', async () => {
    repo.find.mockResolvedValue([
      { flashcard: { id: 'card-1' }, correctCount: 3, incorrectCount: 0, repetitions: 3, status: ProgressStatus.MASTERED },
    ]);

    await service.recordAnswers('user-1', [{ flashcardId: 'card-1', rating: CardRating.AGAIN }]);

    const [[entities]] = transactionSave.mock.calls;
    const [saved] = entities;
    expect(saved.incorrectCount).toBe(1);
    expect(saved.repetitions).toBe(0);
    expect(saved.intervalDays).toBe(0);
    expect(saved.status).toBe(ProgressStatus.LEARNING);
  });

  it('applies multiple ratings for the same card in submission order within one batch', async () => {
    repo.find.mockResolvedValue([]);

    await service.recordAnswers('user-1', [
      { flashcardId: 'card-1', rating: CardRating.GOOD },
      { flashcardId: 'card-1', rating: CardRating.GOOD },
    ]);

    const [saved] = transactionSave.mock.calls[0];
    expect(saved).toHaveLength(1);
    expect(saved[0].correctCount).toBe(2);
    expect(saved[0].repetitions).toBe(2);
  });

  describe('getDashboardSummary', () => {
    it('combines the counts aggregate with the set that has the most due cards', async () => {
      const countsBuilder = fluentQueryBuilder({ totalTracked: '10', learningCount: '4', masteredCount: '3', dueCount: '2' });
      const dueSetBuilder = fluentQueryBuilder({ setId: 'set-1', title: 'Spanish Basics', dueCount: '2' });
      repo.createQueryBuilder.mockReturnValueOnce(countsBuilder).mockReturnValueOnce(dueSetBuilder);

      const summary = await service.getDashboardSummary('user-1');

      expect(summary).toEqual({
        totalTracked: 10,
        learningCount: 4,
        masteredCount: 3,
        dueCount: 2,
        dueSet: { id: 'set-1', title: 'Spanish Basics', dueCount: 2 },
      });
    });

    it('returns dueSet: null when nothing is due', async () => {
      const countsBuilder = fluentQueryBuilder({ totalTracked: '5', learningCount: '5', masteredCount: '0', dueCount: '0' });
      const dueSetBuilder = fluentQueryBuilder(undefined);
      repo.createQueryBuilder.mockReturnValueOnce(countsBuilder).mockReturnValueOnce(dueSetBuilder);

      const summary = await service.getDashboardSummary('user-1');

      expect(summary.dueSet).toBeNull();
    });
  });
});
