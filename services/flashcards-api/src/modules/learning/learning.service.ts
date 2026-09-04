import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import { CardRating } from '../progress/card-rating.enum.js';
import { addDays, scheduleNextReview } from '../progress/scheduling.js';
import {
  buildChoices,
  hasEnoughDistinctAnswersForMultipleChoice,
  InsufficientDistractorsError,
} from './algorithms/build-choices.js';
import { normalizeAnswer } from './algorithms/normalize-answer.js';
import {
  dueSequenceAfterMultipleChoicePass,
  dueSequenceAfterWrongAnswer,
  pickNextCard,
  type PendingCardState,
} from './algorithms/retry-queue.js';
import type { SubmitAnswerDto } from './dto/submit-answer.dto.js';

export interface LearningProgress {
  completed: number;
  total: number;
  percent: number;
}

export interface LearningSessionSummary {
  id: string;
  mode: LearningMode;
  status: LearningSessionStatus;
  progress: LearningProgress;
  startedAt: Date;
  completedAt: Date | null;
}

export interface LearningQuestionView {
  type: LearningQuestionType;
  flashcardId: string;
  /** Present only for MULTIPLE_CHOICE — the prompt word/text. */
  front?: string;
  /** Present only for TYPED_ANSWER — the meaning shown; the front is what the user must type, and is never sent. */
  back?: string;
  /** Present only for MULTIPLE_CHOICE — always exactly 4 entries. */
  choices?: string[];
}

export interface AnswerResultView {
  correct: boolean;
  correctAnswer: string;
  session: LearningSessionSummary;
  nextQuestion: LearningQuestionView | null;
}

const INSUFFICIENT_ANSWERS_MESSAGE =
  'This set needs at least 4 cards with distinct answers to use this mode';

@Injectable()
export class LearningService {
  constructor(
    @InjectRepository(LearningSession)
    private readonly sessionsRepository: Repository<LearningSession>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly flashcardSetsService: FlashcardSetsService,
    private readonly flashcardsService: FlashcardsService,
  ) {}

  /**
   * Finds or creates the single (user, set, mode) progression and returns
   * it along with the question currently being served. The insert uses
   * `ON CONFLICT DO NOTHING` rather than check-then-insert so two
   * concurrent first-opens can't both try to create a session — Postgres
   * makes the loser's INSERT wait for the winner's transaction to finish
   * before deciding to skip, so the loser's follow-up read always sees the
   * winner's fully-seeded row, never a half-created one.
   */
  async start(
    userId: string,
    setId: string,
    mode: LearningMode,
  ): Promise<{ session: LearningSessionSummary; question: LearningQuestionView | null }> {
    await this.flashcardSetsService.findOneVisibleTo(setId, userId);

    const cards = await this.flashcardsService.findBySet(setId);
    if (cards.length === 0) {
      throw new BadRequestException('This set has no cards yet');
    }
    if (!hasEnoughDistinctAnswersForMultipleChoice(cards)) {
      throw new BadRequestException(INSUFFICIENT_ANSWERS_MESSAGE);
    }

    return this.dataSource.transaction(async (manager) => {
      const insertResult = await manager
        .createQueryBuilder()
        .insert()
        .into(LearningSession)
        .values({ user: { id: userId }, set: { id: setId }, mode, sequence: 0 })
        .orIgnore()
        .execute();
      // Not insertResult.identifiers: TypeORM's InsertQueryBuilder always
      // pushes one identifier per submitted value set regardless of whether
      // ON CONFLICT DO NOTHING actually skipped the row (it reads whatever
      // id ended up on the in-memory entity, which is empty but still
      // "present" either way) — verified empirically against Postgres, this
      // does NOT reflect what was actually inserted. insertResult.raw is the
      // real driver result for the RETURNING clause: empty when the insert
      // was skipped, one row when it wasn't.
      const created = insertResult.raw.length > 0;

      const session = await manager.getRepository(LearningSession).findOne({
        where: { user: { id: userId }, set: { id: setId }, mode },
        relations: { currentCard: true, set: true },
      });
      if (!session) {
        throw new NotFoundException('Learning session not found');
      }

      if (created) {
        // Defaults are set explicitly rather than left to the column's DB
        // default — serveNextQuestion() below reads these rows back within
        // this same transaction, before any round trip could apply them.
        await manager.save(
          cards.map((card) =>
            manager.create(LearningCardState, {
              session: { id: session.id },
              flashcard: { id: card.id },
              completed: false,
              attempts: 0,
              correctAttempts: 0,
              incorrectAttempts: 0,
              dueSequence: 0,
              mcCompleted: false,
              typedCompleted: false,
              repetitions: 0,
              intervalDays: 0,
              lastReviewedAt: null,
              nextReviewAt: null,
            }),
          ),
        );
        try {
          await this.serveNextQuestion(manager, session);
        } catch (error) {
          if (error instanceof InsufficientDistractorsError) {
            throw new BadRequestException(INSUFFICIENT_ANSWERS_MESSAGE);
          }
          throw error;
        }
      }

      const progress = await this.computeProgress(manager, session.id);
      return { session: this.toSummary(session, progress), question: this.toQuestionView(session) };
    });
  }

  async getSession(sessionId: string, userId: string): Promise<LearningSessionSummary> {
    const session = await this.findByIdOrFail(this.sessionsRepository, sessionId);
    this.assertOwner(session, userId);
    const progress = await this.computeProgress(this.dataSource.manager, session.id);
    return this.toSummary(session, progress);
  }

  /**
   * Idempotently returns the question currently persisted on the session —
   * a refresh or reconnect must replay the same choices, not generate a
   * fresh (and different) quiz. Only regenerates when `currentCard` is
   * null while still IN_PROGRESS, which happens if the card being served
   * was deleted out from under the session.
   */
  async getCurrentQuestion(sessionId: string, userId: string): Promise<LearningQuestionView | null> {
    const session = await this.findByIdOrFail(this.sessionsRepository, sessionId);
    this.assertOwner(session, userId);

    if (session.status === LearningSessionStatus.COMPLETED) {
      return null;
    }
    if (session.currentCard) {
      return this.toQuestionView(session);
    }

    return this.dataSource.transaction(async (manager) => {
      // lockTables restricts FOR UPDATE to the session row itself — Postgres
      // refuses FOR UPDATE on the nullable side of the currentCard outer
      // join otherwise ("FOR UPDATE cannot be applied to the nullable side
      // of an outer join"). The joined rows don't need their own lock: only
      // the session row is ever mutated by a concurrent request.
      const locked = await manager
        .getRepository(LearningSession)
        .createQueryBuilder('session')
        .setLock('pessimistic_write', undefined, ['session'])
        .leftJoinAndSelect('session.currentCard', 'currentCard')
        .leftJoinAndSelect('session.set', 'set')
        .where('session.id = :sessionId', { sessionId })
        .getOne();
      if (!locked) {
        throw new NotFoundException('Learning session not found');
      }
      if (locked.currentCard || locked.status === LearningSessionStatus.COMPLETED) {
        return this.toQuestionView(locked);
      }
      await this.serveNextQuestion(manager, locked);
      return this.toQuestionView(locked);
    });
  }

  /** Both mode rows (or absence) for a set, for the set-detail page's progress cards. */
  async listForSet(userId: string, setId: string): Promise<LearningSessionSummary[]> {
    await this.flashcardSetsService.findOneVisibleTo(setId, userId);

    const sessions = await this.sessionsRepository.find({
      where: { user: { id: userId }, set: { id: setId } },
    });
    return Promise.all(
      sessions.map(async (session) =>
        this.toSummary(session, await this.computeProgress(this.dataSource.manager, session.id)),
      ),
    );
  }

  /**
   * The integrity boundary: the client submits only which card it answered
   * and what it answered — never correctness, progress, or completion.
   * Everything is recomputed here, inside a transaction that locks the
   * session row so a duplicate submission (lost-response retry, two tabs)
   * can't double-advance progress — the first request to commit clears
   * `currentCard`/advances `sequence`, so a retry of the same request finds
   * its `flashcardId` no longer matches the (new) current question and is
   * rejected with 409, not silently reapplied.
   */
  async answer(sessionId: string, userId: string, dto: SubmitAnswerDto): Promise<AnswerResultView> {
    return this.dataSource.transaction(async (manager) => {
      // See the identical lockTables note in getCurrentQuestion() above —
      // FOR UPDATE must be restricted to the session row itself.
      const session = await manager
        .getRepository(LearningSession)
        .createQueryBuilder('session')
        .setLock('pessimistic_write', undefined, ['session'])
        .leftJoinAndSelect('session.user', 'user')
        .leftJoinAndSelect('session.set', 'set')
        .leftJoinAndSelect('session.currentCard', 'currentCard')
        .where('session.id = :sessionId', { sessionId })
        .getOne();

      if (!session) {
        throw new NotFoundException('Learning session not found');
      }
      this.assertOwner(session, userId);

      if (session.status !== LearningSessionStatus.IN_PROGRESS || !session.currentCard) {
        throw new ConflictException('This learning session has no active question to answer');
      }
      if (session.currentCard.id !== dto.flashcardId) {
        throw new ConflictException(
          'This answer no longer matches the active question — refetch the current question and retry',
        );
      }

      const cardStateRepo = manager.getRepository(LearningCardState);
      const cardState = await cardStateRepo.findOne({
        where: { session: { id: session.id }, flashcard: { id: session.currentCard.id } },
        relations: { flashcard: true },
      });
      if (!cardState) {
        throw new NotFoundException('Card state not found for the active question');
      }

      const questionType = session.currentQuestionType;
      let correct: boolean;
      let correctAnswer: string;

      if (questionType === LearningQuestionType.MULTIPLE_CHOICE) {
        correctAnswer = cardState.flashcard.back;
        if (dto.selectedText === undefined || dto.typedText !== undefined) {
          throw new BadRequestException('This question expects selectedText, not typedText');
        }
        if (!session.currentChoices?.includes(dto.selectedText)) {
          throw new BadRequestException('selectedText is not one of the choices shown for this question');
        }
        correct = dto.selectedText === correctAnswer;
      } else {
        correctAnswer = cardState.flashcard.front;
        if (dto.typedText === undefined || dto.selectedText !== undefined) {
          throw new BadRequestException('This question expects typedText, not selectedText');
        }
        correct = normalizeAnswer(dto.typedText) === normalizeAnswer(correctAnswer);
      }

      session.sequence += 1;
      cardState.attempts += 1;
      if (correct) {
        cardState.correctAttempts += 1;
      } else {
        cardState.incorrectAttempts += 1;
      }

      if (session.mode === LearningMode.CRAM) {
        if (correct) {
          cardState.completed = true;
        } else {
          cardState.dueSequence = dueSequenceAfterWrongAnswer(session.sequence);
        }
      } else {
        // DEEP_LEARNING: the short-term retry queue (dueSequence) and the
        // longer-horizon spaced-repetition fields are two separate
        // mechanisms updated from the same answer event — neither reads
        // the other, and completion below never consults nextReviewAt.
        const scheduled = scheduleNextReview(cardState.repetitions, correct ? CardRating.GOOD : CardRating.AGAIN);
        cardState.repetitions = scheduled.repetitions;
        cardState.intervalDays = scheduled.intervalDays;
        cardState.lastReviewedAt = new Date();
        cardState.nextReviewAt = addDays(cardState.lastReviewedAt, scheduled.intervalDays);

        if (questionType === LearningQuestionType.MULTIPLE_CHOICE) {
          if (correct) {
            cardState.mcCompleted = true;
            cardState.dueSequence = dueSequenceAfterMultipleChoicePass(session.sequence);
          } else {
            cardState.dueSequence = dueSequenceAfterWrongAnswer(session.sequence);
          }
        } else {
          if (correct) {
            cardState.typedCompleted = true;
            cardState.completed = true;
          } else {
            cardState.dueSequence = dueSequenceAfterWrongAnswer(session.sequence);
          }
        }
      }

      await cardStateRepo.save(cardState);
      await this.serveNextQuestion(manager, session);

      const progress = await this.computeProgress(manager, session.id);

      return {
        correct,
        correctAnswer,
        session: this.toSummary(session, progress),
        nextQuestion: this.toQuestionView(session),
      };
    });
  }

  /**
   * Picks the next not-yet-completed card (see algorithms/retry-queue.ts),
   * decides its question type, and — for multiple choice — builds its 4
   * choices, persisting the result onto `session` (mutated in place) so a
   * refresh replays the identical question. Marks the session COMPLETED
   * once no pending cards remain.
   */
  private async serveNextQuestion(manager: EntityManager, session: LearningSession): Promise<void> {
    const pendingRows = await manager.getRepository(LearningCardState).find({
      where: { session: { id: session.id }, completed: false },
      relations: { flashcard: true },
    });

    if (pendingRows.length === 0) {
      session.status = LearningSessionStatus.COMPLETED;
      session.completedAt = new Date();
      session.currentCard = null;
      session.currentQuestionType = null;
      session.currentChoices = null;
      await manager.getRepository(LearningSession).save(session);
      return;
    }

    const candidates: PendingCardState[] = pendingRows.map((row) => ({
      flashcardId: row.flashcard.id,
      flashcardPosition: row.flashcard.position,
      dueSequence: row.dueSequence,
      attempts: row.attempts,
    }));
    const next = pickNextCard(candidates, session.sequence);
    const chosenRow = pendingRows.find((row) => row.flashcard.id === next?.flashcardId);
    if (!chosenRow) {
      throw new NotFoundException('Could not select the next card for this session');
    }

    const questionType = chosenRow.mcCompleted
      ? LearningQuestionType.TYPED_ANSWER
      : LearningQuestionType.MULTIPLE_CHOICE;

    if (questionType === LearningQuestionType.MULTIPLE_CHOICE) {
      const setCards = await this.fetchSetAnswerCandidates(manager, session.set.id);
      session.currentChoices = buildChoices({ id: chosenRow.flashcard.id, back: chosenRow.flashcard.back }, setCards);
    } else {
      session.currentChoices = null;
    }

    session.currentCard = chosenRow.flashcard;
    session.currentQuestionType = questionType;
    await manager.getRepository(LearningSession).save(session);
  }

  /** Distractor pool for buildChoices — always the whole set, not just incomplete cards, so distractors never run out late in a session. */
  private fetchSetAnswerCandidates(manager: EntityManager, setId: string) {
    return manager.getRepository(Flashcard).find({
      where: { set: { id: setId } },
      select: { id: true, back: true },
    });
  }

  private async computeProgress(manager: EntityManager, sessionId: string): Promise<LearningProgress> {
    const row = await manager
      .getRepository(LearningCardState)
      .createQueryBuilder('state')
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE state.completed)', 'completed')
      .where('state.session_id = :sessionId', { sessionId })
      .getRawOne<{ total: string; completed: string }>();

    const total = Number(row?.total ?? 0);
    const completed = Number(row?.completed ?? 0);
    return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
  }

  private toSummary(session: LearningSession, progress: LearningProgress): LearningSessionSummary {
    return {
      id: session.id,
      mode: session.mode,
      status: session.status,
      progress,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    };
  }

  private toQuestionView(session: LearningSession): LearningQuestionView | null {
    if (session.status !== LearningSessionStatus.IN_PROGRESS || !session.currentCard) {
      return null;
    }
    if (session.currentQuestionType === LearningQuestionType.MULTIPLE_CHOICE) {
      return {
        type: LearningQuestionType.MULTIPLE_CHOICE,
        flashcardId: session.currentCard.id,
        front: session.currentCard.front,
        choices: session.currentChoices ?? [],
      };
    }
    return {
      type: LearningQuestionType.TYPED_ANSWER,
      flashcardId: session.currentCard.id,
      back: session.currentCard.back,
    };
  }

  private async findByIdOrFail(repo: Repository<LearningSession>, sessionId: string): Promise<LearningSession> {
    const session = await repo.findOne({
      where: { id: sessionId },
      relations: { user: true, set: true, currentCard: true },
    });
    if (!session) {
      throw new NotFoundException('Learning session not found');
    }
    return session;
  }

  // Session ownership (not set-visibility): a learning session belonging
  // to someone else is a plain 403, mirroring StudyService.findOneForUser
  // — not the 404-before-403 masking used for set *visibility*, which
  // exists to hide whether a private set exists at all. Here the caller
  // already knows the session id; there's nothing left to mask.
  private assertOwner(session: LearningSession, userId: string): void {
    if (session.user.id !== userId) {
      throw new ForbiddenException('This learning session does not belong to you');
    }
  }
}
