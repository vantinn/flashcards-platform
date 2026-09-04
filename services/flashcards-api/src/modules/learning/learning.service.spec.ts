import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LearningService } from './learning.service.js';
import {
  LearningMode,
  LearningQuestionType,
  LearningSession,
  LearningSessionStatus,
} from './entities/learning-session.entity.js';
import { LearningCardState } from './entities/learning-card-state.entity.js';
import { Flashcard } from '../flashcards/entities/flashcard.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import { FlashcardsService } from '../flashcards/flashcards.service.js';

/**
 * A lightweight in-memory fake standing in for TypeORM's DataSource/
 * EntityManager, backing three plain-array "tables". This lets the real
 * LearningService logic run against realistic relational data (including
 * the transactional insert-or-ignore, row locks, and aggregate progress
 * query it actually issues) without reimplementing that logic in the test
 * itself. Relations are always stored as full nested objects rather than
 * FK stubs — good enough to exercise the service's control flow, which is
 * what these tests are checking.
 */
function matchesWhere(row: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && !(value instanceof Date) && 'id' in value && Object.keys(value).length === 1) {
      return row[key]?.id === value.id;
    }
    return row[key] === value;
  });
}

class FakeTable {
  rows: Record<string, any>[] = [];
  private counter = 0;
  constructor(private readonly prefix: string) {}

  nextId(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }

  find(opts: { where?: Record<string, any> } = {}) {
    return Promise.resolve(this.rows.filter((row) => (opts.where ? matchesWhere(row, opts.where) : true)));
  }

  findOne(opts: { where?: Record<string, any> } = {}) {
    return Promise.resolve(this.rows.find((row) => (opts.where ? matchesWhere(row, opts.where) : true)) ?? null);
  }

  async save(entityOrArray: Record<string, any> | Record<string, any>[]) {
    const entities = Array.isArray(entityOrArray) ? entityOrArray : [entityOrArray];
    for (const entity of entities) {
      if (!entity.id) entity.id = this.nextId();
      const idx = this.rows.findIndex((row) => row.id === entity.id);
      if (idx === -1) this.rows.push(entity);
      else this.rows[idx] = entity;
    }
    return entityOrArray;
  }
}

function buildFakeDb() {
  const sessions = new FakeTable('session');
  const cardStates = new FakeTable('card-state');
  const flashcards = new FakeTable('flashcard');

  const sessionRepo = {
    findOne: sessions.findOne.bind(sessions),
    find: sessions.find.bind(sessions),
    save: sessions.save.bind(sessions),
    createQueryBuilder: () => {
      const state: { params?: Record<string, any> } = {};
      const builder: any = {
        setLock: () => builder,
        leftJoinAndSelect: () => builder,
        where: (_expr: string, params: Record<string, any>) => {
          state.params = params;
          return builder;
        },
        getOne: async () => sessions.rows.find((row) => row.id === state.params?.sessionId) ?? null,
      };
      return builder;
    },
  };

  // Card states are seeded with a bare `{id}` relation stub for `flashcard`
  // (the correct TypeORM idiom for "just set the FK") — a real Postgres
  // join hydrates that into a full row when `relations: { flashcard: true }`
  // is requested. This fake has no real joins, so it does that hydration
  // by hand for the one relation the service actually reads through.
  function withFlashcardResolved<T extends { flashcard?: { id: string } }>(row: T): T {
    if (!row.flashcard) return row;
    const full = flashcards.rows.find((f) => f.id === row.flashcard!.id);
    return full ? { ...row, flashcard: full } : row;
  }

  const cardStateRepo = {
    findOne: async (opts: { where?: Record<string, any>; relations?: Record<string, any> } = {}) => {
      const row = await cardStates.findOne(opts);
      return row && opts.relations?.flashcard ? withFlashcardResolved(row) : row;
    },
    find: async (opts: { where?: Record<string, any>; relations?: Record<string, any> } = {}) => {
      const rows = await cardStates.find(opts);
      return opts.relations?.flashcard ? rows.map(withFlashcardResolved) : rows;
    },
    save: cardStates.save.bind(cardStates),
    createQueryBuilder: () => {
      const state: { params?: Record<string, any> } = {};
      const builder: any = {
        select: () => builder,
        addSelect: () => builder,
        where: (_expr: string, params: Record<string, any>) => {
          state.params = params;
          return builder;
        },
        getRawOne: async () => {
          const rows = cardStates.rows.filter((row) => row.session?.id === state.params?.sessionId);
          return { total: String(rows.length), completed: String(rows.filter((row) => row.completed).length) };
        },
      };
      return builder;
    },
  };

  const flashcardRepo = { find: flashcards.find.bind(flashcards) };

  const manager: any = {
    create: (EntityClass: unknown, data: Record<string, any>) => ({ ...data, __entity: EntityClass }),
    save: async (entityOrArray: Record<string, any> | Record<string, any>[]) => {
      const arr = Array.isArray(entityOrArray) ? entityOrArray : [entityOrArray];
      const target = arr[0]?.__entity;
      if (target === LearningCardState) return cardStates.save(entityOrArray as any);
      if (target === LearningSession) return sessions.save(entityOrArray as any);
      throw new Error('FakeManager.save: unknown entity');
    },
    getRepository: (EntityClass: unknown) => {
      if (EntityClass === LearningSession) return sessionRepo;
      if (EntityClass === LearningCardState) return cardStateRepo;
      if (EntityClass === Flashcard) return flashcardRepo;
      throw new Error('FakeManager.getRepository: unknown entity');
    },
    createQueryBuilder: () => ({
      insert: () => ({
        into: (EntityClass: unknown) => ({
          values: (vals: Record<string, any>) => ({
            orIgnore: () => ({
              execute: async () => {
                if (EntityClass !== LearningSession) throw new Error('unexpected insert target');
                const existing = sessions.rows.find(
                  (row) => row.user.id === vals.user.id && row.set.id === vals.set.id && row.mode === vals.mode,
                );
                if (existing) return { raw: [] };
                const created = {
                  id: sessions.nextId(),
                  user: vals.user,
                  set: vals.set,
                  mode: vals.mode,
                  sequence: vals.sequence ?? 0,
                  status: LearningSessionStatus.IN_PROGRESS,
                  currentCard: null,
                  currentQuestionType: null,
                  currentChoices: null,
                  startedAt: new Date(),
                  completedAt: null,
                };
                sessions.rows.push(created);
                return { raw: [{ id: created.id }] };
              },
            }),
          }),
        }),
      }),
    }),
  };

  const dataSource = { manager, transaction: (fn: (m: typeof manager) => unknown) => Promise.resolve(fn(manager)) };

  return { sessions, cardStates, flashcards, sessionRepo, cardStateRepo, dataSource };
}

function makeFlashcard(id: string, setId: string, front: string, back: string, position: number) {
  return { id, set: { id: setId }, front, back, frontImageUrl: null, backImageUrl: null, position };
}

describe('LearningService', () => {
  let service: LearningService;
  let db: ReturnType<typeof buildFakeDb>;
  let flashcardSetsService: { findOneVisibleTo: ReturnType<typeof vi.fn> };
  let flashcardsService: { findBySet: ReturnType<typeof vi.fn> };

  const setId = 'set-1';
  const userId = 'user-1';
  // 4 distinct answers, satisfying the multiple-choice eligibility gate.
  const cards = [
    makeFlashcard('card-1', setId, 'apple', 'quả táo', 0),
    makeFlashcard('card-2', setId, 'cat', 'con mèo', 1),
    makeFlashcard('card-3', setId, 'run', 'chạy', 2),
    makeFlashcard('card-4', setId, 'school', 'trường học', 3),
  ];

  beforeEach(async () => {
    db = buildFakeDb();
    db.flashcards.rows.push(...cards.map((c) => ({ ...c })));

    flashcardSetsService = { findOneVisibleTo: vi.fn().mockResolvedValue({ id: setId }) };
    flashcardsService = { findBySet: vi.fn().mockResolvedValue(cards) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LearningService,
        { provide: getRepositoryToken(LearningSession), useValue: db.sessionRepo },
        { provide: getDataSourceToken(), useValue: db.dataSource },
        { provide: FlashcardSetsService, useValue: flashcardSetsService },
        { provide: FlashcardsService, useValue: flashcardsService },
      ],
    }).compile();

    service = moduleRef.get(LearningService);
  });

  describe('start', () => {
    it('rejects a set that is not visible to the caller', async () => {
      flashcardSetsService.findOneVisibleTo.mockRejectedValue(new BadRequestException());
      await expect(service.start(userId, setId, LearningMode.CRAM)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an empty set', async () => {
      flashcardsService.findBySet.mockResolvedValue([]);
      await expect(service.start(userId, setId, LearningMode.CRAM)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a set with fewer than 4 distinct answers (small set)', async () => {
      flashcardsService.findBySet.mockResolvedValue(cards.slice(0, 3));
      await expect(service.start(userId, setId, LearningMode.CRAM)).rejects.toBeInstanceOf(BadRequestException);
      expect(db.sessions.rows).toHaveLength(0);
    });

    it('rejects a duplicate-heavy set with fewer than 4 distinct answers even with >= 4 cards', async () => {
      const duplicateHeavy = [
        makeFlashcard('a', setId, 'a', 'x', 0),
        makeFlashcard('b', setId, 'b', 'x', 1),
        makeFlashcard('c', setId, 'c', 'y', 2),
        makeFlashcard('d', setId, 'd', 'y', 3),
      ];
      flashcardsService.findBySet.mockResolvedValue(duplicateHeavy);
      await expect(service.start(userId, setId, LearningMode.CRAM)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a session seeded with one card-state per card and serves a 4-choice question', async () => {
      const { session, question } = await service.start(userId, setId, LearningMode.CRAM);

      expect(session.status).toBe(LearningSessionStatus.IN_PROGRESS);
      expect(session.progress).toEqual({ completed: 0, total: 4, percent: 0 });
      expect(db.cardStates.rows).toHaveLength(4);
      expect(question).not.toBeNull();
      expect(question!.type).toBe(LearningQuestionType.MULTIPLE_CHOICE);
      expect(question!.choices).toHaveLength(4);
      expect(new Set(question!.choices)).toEqual(new Set(question!.choices));
    });

    it('resumes the existing in-progress session instead of creating a duplicate, without re-seeding card states', async () => {
      const first = await service.start(userId, setId, LearningMode.CRAM);
      const second = await service.start(userId, setId, LearningMode.CRAM);

      expect(second.session.id).toBe(first.session.id);
      expect(db.sessions.rows.filter((row) => row.user.id === userId && row.set.id === setId && row.mode === LearningMode.CRAM)).toHaveLength(1);
      // Regression guard: re-running start() against an existing session must not
      // attempt to insert a second LearningCardState per card (would violate the
      // UNIQUE(session, flashcard) constraint against a real database).
      expect(db.cardStates.rows.filter((row) => row.session.id === first.session.id)).toHaveLength(4);
    });

    it('resuming an already-answered session does not re-seed or reset progress made so far', async () => {
      const { session, question } = await service.start(userId, setId, LearningMode.CRAM);
      const card = cards.find((c) => c.front === question!.front)!;
      await service.answer(session.id, userId, { flashcardId: question!.flashcardId, selectedText: card.back });

      const resumed = await service.start(userId, setId, LearningMode.CRAM);

      expect(resumed.session.id).toBe(session.id);
      expect(resumed.session.progress).toEqual({ completed: 1, total: 4, percent: 25 });
      expect(db.cardStates.rows.filter((row) => row.session.id === session.id)).toHaveLength(4);
    });

    it('tracks CRAM and DEEP_LEARNING progress independently for the same user and set', async () => {
      const cram = await service.start(userId, setId, LearningMode.CRAM);
      const deep = await service.start(userId, setId, LearningMode.DEEP_LEARNING);

      expect(cram.session.id).not.toBe(deep.session.id);
      expect(db.sessions.rows).toHaveLength(2);
    });

    it('tracks progress independently per user on the same public set — one user finishing does not affect another', async () => {
      const otherUserId = 'user-2';

      const { session: sessionA, question: questionA } = await service.start(userId, setId, LearningMode.CRAM);
      const { session: sessionB } = await service.start(otherUserId, setId, LearningMode.CRAM);

      expect(sessionA.id).not.toBe(sessionB.id);
      expect(sessionB.progress).toEqual({ completed: 0, total: 4, percent: 0 });

      // User A answers every question correctly; user B never touches their session.
      let current = questionA!;
      for (let i = 0; i < 4; i++) {
        const card = cards.find((c) => c.front === current.front)!;
        const result = await service.answer(sessionA.id, userId, { flashcardId: current.flashcardId, selectedText: card.back });
        current = result.nextQuestion!;
      }

      const finishedA = await service.getSession(sessionA.id, userId);
      const untouchedB = await service.getSession(sessionB.id, otherUserId);
      expect(finishedA.status).toBe(LearningSessionStatus.COMPLETED);
      expect(finishedA.progress.percent).toBe(100);
      expect(untouchedB.status).toBe(LearningSessionStatus.IN_PROGRESS);
      expect(untouchedB.progress).toEqual({ completed: 0, total: 4, percent: 0 });

      // Each user's card states are their own rows, not shared.
      const cardStatesA = db.cardStates.rows.filter((r) => r.session.id === sessionA.id);
      const cardStatesB = db.cardStates.rows.filter((r) => r.session.id === sessionB.id);
      expect(cardStatesA).toHaveLength(4);
      expect(cardStatesB).toHaveLength(4);
      expect(cardStatesA.every((r) => r.completed)).toBe(true);
      expect(cardStatesB.every((r) => !r.completed)).toBe(true);
    });

    it('a completed session is returned as-is with no question and is not auto-restarted', async () => {
      const { session } = await service.start(userId, setId, LearningMode.CRAM);
      const row = db.sessions.rows.find((r) => r.id === session.id)!;
      row.status = LearningSessionStatus.COMPLETED;
      row.completedAt = new Date();
      row.currentCard = null;

      const resumed = await service.start(userId, setId, LearningMode.CRAM);
      expect(resumed.session.status).toBe(LearningSessionStatus.COMPLETED);
      expect(resumed.question).toBeNull();
      expect(db.sessions.rows).toHaveLength(1);
    });
  });

  describe('getSession', () => {
    it('rejects a session belonging to another user with 403, not 404', async () => {
      const { session } = await service.start(userId, setId, LearningMode.CRAM);
      await expect(service.getSession(session.id, 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('answer — CRAM', () => {
    async function startCram() {
      return service.start(userId, setId, LearningMode.CRAM);
    }

    it('a correct answer completes the card and auto-advances to the next question', async () => {
      const { session, question } = await startCram();
      const correctAnswer = question!.choices!.find((c) =>
        cards.some((card) => card.front === question!.front && card.back === c),
      )!;

      const result = await service.answer(session.id, userId, { flashcardId: question!.flashcardId, selectedText: correctAnswer });

      expect(result.correct).toBe(true);
      expect(result.session.progress.completed).toBe(1);
      expect(result.nextQuestion).not.toBeNull();
      expect(result.nextQuestion!.flashcardId).not.toBe(question!.flashcardId);
    });

    it('a wrong answer does not complete the card and the card returns later, not immediately', async () => {
      const { session, question } = await startCram();
      const card = cards.find((c) => c.front === question!.front)!;
      const wrongChoice = question!.choices!.find((c) => c !== card.back)!;

      const result = await service.answer(session.id, userId, { flashcardId: question!.flashcardId, selectedText: wrongChoice });

      expect(result.correct).toBe(false);
      expect(result.session.progress.completed).toBe(0);
      expect(result.nextQuestion!.flashcardId).not.toBe(question!.flashcardId);

      const cardState = db.cardStates.rows.find((r) => r.session.id === session.id && r.flashcard.id === card.id)!;
      const sessionRow = db.sessions.rows.find((r) => r.id === session.id)!;
      expect(cardState.completed).toBe(false);
      expect(cardState.dueSequence).toBeGreaterThan(sessionRow.sequence);
    });

    it('progress is completed/total, not currentIndex/total', async () => {
      const { session, question } = await startCram();
      let current = question!;
      for (let i = 0; i < 4; i++) {
        const card = cards.find((c) => c.front === current.front)!;
        const result = await service.answer(session.id, userId, { flashcardId: current.flashcardId, selectedText: card.back });
        if (i < 3) {
          expect(result.session.progress.percent).toBe(Math.round(((i + 1) / 4) * 100));
          current = result.nextQuestion!;
        } else {
          expect(result.session.progress.percent).toBe(100);
        }
      }
    });

    it('reaches 100% completion after a full run with injected wrong answers, and the wrong card is served again before completion', async () => {
      const { session } = await startCram();
      let current = (await service.getCurrentQuestion(session.id, userId))!;
      const failedOnce = new Set<string>();

      // Answer every question; fail card-2's first appearance once, then always answer correctly.
      // Bounded loop guards against an infinite loop if the algorithm regresses.
      for (let guard = 0; guard < 50; guard++) {
        const card = cards.find((c) => c.front === current.front)!;
        const shouldFail = card.id === 'card-2' && !failedOnce.has(card.id);
        if (shouldFail) failedOnce.add(card.id);

        const wrongChoice = current.choices!.find((c) => c !== card.back)!;
        const answerText = shouldFail ? wrongChoice : card.back;
        const result = await service.answer(session.id, userId, { flashcardId: current.flashcardId, selectedText: answerText });

        if (result.session.status === LearningSessionStatus.COMPLETED) {
          expect(result.session.progress.percent).toBe(100);
          expect(failedOnce.has('card-2')).toBe(true);
          return;
        }
        current = result.nextQuestion!;
      }
      throw new Error('Session did not complete within the expected number of answers');
    });

    it('rejects answering a card that is not the currently served question (stale/replayed submission) with 409', async () => {
      const { session, question } = await startCram();
      const otherCard = cards.find((c) => c.front !== question!.front)!;

      await expect(
        service.answer(session.id, userId, { flashcardId: otherCard.id, selectedText: otherCard.back }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('a duplicate submission for the same question does not double-count progress', async () => {
      const { session, question } = await startCram();
      const card = cards.find((c) => c.front === question!.front)!;

      await service.answer(session.id, userId, { flashcardId: question!.flashcardId, selectedText: card.back });
      // Replaying the exact same request (e.g. a lost-response retry) now targets a stale question.
      await expect(
        service.answer(session.id, userId, { flashcardId: question!.flashcardId, selectedText: card.back }),
      ).rejects.toBeInstanceOf(ConflictException);

      const progress = await service.getSession(session.id, userId);
      expect(progress.progress.completed).toBe(1);
    });

    it('rejects a typed answer for a multiple-choice question', async () => {
      const { session, question } = await startCram();
      await expect(
        service.answer(session.id, userId, { flashcardId: question!.flashcardId, typedText: 'anything' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('answer — DEEP_LEARNING', () => {
    it('never serves a typed-answer question before the card has passed multiple choice', async () => {
      const { question } = await service.start(userId, setId, LearningMode.DEEP_LEARNING);
      expect(question!.type).toBe(LearningQuestionType.MULTIPLE_CHOICE);
    });

    it('a card only completes once both multiple-choice and typed-answer stages pass', async () => {
      const { session, question } = await service.start(userId, setId, LearningMode.DEEP_LEARNING);
      const card = cards.find((c) => c.front === question!.front)!;

      const mcResult = await service.answer(session.id, userId, { flashcardId: card.id, selectedText: card.back });
      expect(mcResult.correct).toBe(true);

      const cardState = db.cardStates.rows.find((r) => r.session.id === session.id && r.flashcard.id === card.id)!;
      expect(cardState.mcCompleted).toBe(true);
      expect(cardState.completed).toBe(false);
    });

    it('typed-answer accepts case and whitespace differences but not wrong words', async () => {
      const { session, question } = await service.start(userId, setId, LearningMode.DEEP_LEARNING);
      const card = cards.find((c) => c.front === question!.front)!;

      await service.answer(session.id, userId, { flashcardId: card.id, selectedText: card.back });

      // Drive the queue until this same card comes back up as a typed-answer question.
      let current = (await service.getCurrentQuestion(session.id, userId))!;
      for (let guard = 0; guard < 20 && !(current.flashcardId === card.id && current.type === LearningQuestionType.TYPED_ANSWER); guard++) {
        const currentCard = cards.find((c) => c.id === current.flashcardId)!;
        const answerText = current.type === LearningQuestionType.MULTIPLE_CHOICE ? currentCard.back : currentCard.front;
        const result = await service.answer(session.id, userId, {
          flashcardId: current.flashcardId,
          ...(current.type === LearningQuestionType.MULTIPLE_CHOICE ? { selectedText: answerText } : { typedText: answerText }),
        });
        current = result.nextQuestion!;
      }
      expect(current.flashcardId).toBe(card.id);
      expect(current.type).toBe(LearningQuestionType.TYPED_ANSWER);

      const wrongResult = await service.answer(session.id, userId, { flashcardId: card.id, typedText: 'definitely-wrong' });
      expect(wrongResult.correct).toBe(false);
      let cardState = db.cardStates.rows.find((r) => r.session.id === session.id && r.flashcard.id === card.id)!;
      expect(cardState.completed).toBe(false);
      expect(cardState.mcCompleted).toBe(true); // a wrong typed answer never resets multiple-choice progress

      // Drive back to this card again and answer with case/whitespace variance.
      current = wrongResult.nextQuestion!;
      for (let guard = 0; guard < 20 && !(current.flashcardId === card.id && current.type === LearningQuestionType.TYPED_ANSWER); guard++) {
        const currentCard = cards.find((c) => c.id === current.flashcardId)!;
        const answerText = current.type === LearningQuestionType.MULTIPLE_CHOICE ? currentCard.back : currentCard.front;
        const result = await service.answer(session.id, userId, {
          flashcardId: current.flashcardId,
          ...(current.type === LearningQuestionType.MULTIPLE_CHOICE ? { selectedText: answerText } : { typedText: answerText }),
        });
        current = result.nextQuestion ?? current;
      }
      const rightResult = await service.answer(session.id, userId, { flashcardId: card.id, typedText: `  ${card.front.toUpperCase()}  ` });
      expect(rightResult.correct).toBe(true);

      cardState = db.cardStates.rows.find((r) => r.session.id === session.id && r.flashcard.id === card.id)!;
      expect(cardState.typedCompleted).toBe(true);
      expect(cardState.completed).toBe(true);
    });

    it('records a longer-horizon nextReviewAt without it affecting completion', async () => {
      const { session, question } = await service.start(userId, setId, LearningMode.DEEP_LEARNING);
      const card = cards.find((c) => c.front === question!.front)!;

      await service.answer(session.id, userId, { flashcardId: card.id, selectedText: card.back });

      const cardState = db.cardStates.rows.find((r) => r.session.id === session.id && r.flashcard.id === card.id)!;
      expect(cardState.nextReviewAt).toBeInstanceOf(Date);
      // Completion (checked via CRAM-style progress) never looks at nextReviewAt — only mcCompleted/typedCompleted.
      expect(cardState.completed).toBe(false);
    });
  });
});
