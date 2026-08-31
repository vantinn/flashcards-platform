import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudySession } from './entities/study-session.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import { FlashcardsService } from '../flashcards/flashcards.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { CardRating } from '../progress/card-rating.enum.js';
import type { CompleteStudySessionDto } from './dto/complete-study-session.dto.js';

@Injectable()
export class StudyService {
  constructor(
    @InjectRepository(StudySession)
    private readonly studySessionsRepository: Repository<StudySession>,
    private readonly flashcardSetsService: FlashcardSetsService,
    private readonly flashcardsService: FlashcardsService,
    private readonly progressService: ProgressService,
  ) {}

  async start(userId: string, setId: string): Promise<StudySession> {
    // A private set can only be studied by its owner — same rule as
    // viewing it. Public/unlisted sets can be studied by anyone.
    await this.flashcardSetsService.findOneVisibleTo(setId, userId);

    const session = this.studySessionsRepository.create({
      user: { id: userId },
      set: { id: setId },
    });
    return this.studySessionsRepository.save(session);
  }

  async findOneForUser(sessionId: string, userId: string): Promise<StudySession> {
    const session = await this.findWithOwnerOrFail(sessionId);
    if (session.user.id !== userId) {
      throw new ForbiddenException('This study session does not belong to you');
    }
    return session;
  }

  async complete(sessionId: string, userId: string, dto: CompleteStudySessionDto): Promise<StudySession> {
    const session = await this.findWithOwnerOrFail(sessionId);
    if (session.user.id !== userId) {
      throw new ForbiddenException('This study session does not belong to you');
    }

    // A client could otherwise report a `flashcardId` for any card in the
    // system — including ones in a set it never opened, or someone else's
    // private set — and have it recorded as "studied". flashcardId is a
    // request body value, not something derived from the session
    // server-side, so it's checked against what this session's set
    // actually contains before it's trusted. Silently dropped rather than
    // rejecting the whole batch: a card can legitimately disappear from the
    // set mid-session (the owner deletes it in another tab), and losing the
    // rest of an otherwise-valid session over that would be worse than just
    // not recording progress for the one card that no longer exists.
    const validCardIds = new Set((await this.flashcardsService.findBySet(session.set.id)).map((c) => c.id));
    const validResults = dto.results.filter((answer) => validCardIds.has(answer.flashcardId));
    if (validResults.length === 0) {
      throw new BadRequestException('None of the submitted flashcardIds belong to this study session\'s set');
    }

    // Recorded as one batch (single read + single transactional write across
    // every answer) rather than one query pair per answer.
    await this.progressService.recordAnswers(userId, validResults);

    const correctCount = validResults.filter((result) => result.rating !== CardRating.AGAIN).length;

    session.completedAt = new Date();
    session.cardsStudied = validResults.length;
    session.correctCount = correctCount;
    session.incorrectCount = validResults.length - correctCount;

    const saved = await this.studySessionsRepository.save(session);
    await this.flashcardSetsService.incrementStudyCount(session.set.id);
    return saved;
  }

  /**
   * Bounded by default — the dashboard only ever renders a handful of
   * recent sessions, so there's no reason to hand back a power user's
   * entire multi-year history just to read the first few rows off it.
   */
  findHistoryForUser(userId: string, limit = 20): Promise<StudySession[]> {
    return this.studySessionsRepository.find({
      where: { user: { id: userId } },
      relations: { set: true },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Two lean aggregates instead of ever pulling full session rows: the
   * streak only needs which *days* had a completed session (capped at the
   * last 60 — far beyond any streak worth displaying, and cheap to scan),
   * and "reviews today" only needs a single SUM.
   */
  async getStats(userId: string): Promise<{ streakDays: number; reviewsToday: number }> {
    const dayRows = await this.studySessionsRepository
      .createQueryBuilder('session')
      .select("DISTINCT TO_CHAR((session.\"completed_at\" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')", 'day')
      .where('session."user_id" = :userId', { userId })
      .andWhere('session."completed_at" IS NOT NULL')
      .orderBy('day', 'DESC')
      .limit(60)
      .getRawMany<{ day: string }>();

    const reviewsTodayRow = await this.studySessionsRepository
      .createQueryBuilder('session')
      .select('COALESCE(SUM(session."cards_studied"), 0)', 'total')
      .where('session."user_id" = :userId', { userId })
      .andWhere("(session.\"completed_at\" AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date")
      .getRawOne<{ total: string }>();

    return {
      streakDays: computeStreakFromDays(dayRows.map((row) => row.day)),
      reviewsToday: Number(reviewsTodayRow?.total ?? 0),
    };
  }

  private async findWithOwnerOrFail(sessionId: string): Promise<StudySession> {
    const session = await this.studySessionsRepository.findOne({
      where: { id: sessionId },
      relations: { user: true, set: true },
    });
    if (!session) {
      throw new NotFoundException('Study session not found');
    }
    return session;
  }
}

/**
 * Counts consecutive UTC calendar days (most recent first) that appear in
 * `days` (each a 'YYYY-MM-DD' string), starting from today — or from
 * yesterday if nothing's been studied yet today, so the streak doesn't
 * drop to 0 the moment the clock ticks past midnight before that day's
 * first session. Exported for direct unit testing (pure, no DB).
 */
export function computeStreakFromDays(days: string[]): number {
  const studiedDays = new Set(days);
  if (studiedDays.size === 0) return 0;

  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  const key = (date: Date) => date.toISOString().slice(0, 10);

  if (!studiedDays.has(key(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (studiedDays.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
