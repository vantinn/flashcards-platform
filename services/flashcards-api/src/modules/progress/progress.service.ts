import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProgressStatus, StudyProgress } from './entities/study-progress.entity.js';
import type { CardRating } from './card-rating.enum.js';
import { addDays, scheduleNextReview } from './scheduling.js';

export interface DueSet {
  id: string;
  title: string;
  dueCount: number;
}

export interface ProgressSummary {
  totalTracked: number;
  learningCount: number;
  masteredCount: number;
  dueCount: number;
  /** The set with the most cards currently due, for a one-click "review due cards" entry point. Null if nothing is due. */
  dueSet: DueSet | null;
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(StudyProgress)
    private readonly progressRepository: Repository<StudyProgress>,
  ) {}

  findAllForUser(userId: string): Promise<StudyProgress[]> {
    return this.progressRepository.find({
      where: { user: { id: userId } },
      relations: { flashcard: true },
    });
  }

  /**
   * Feeds the dashboard's stat tiles and "Review due cards" action with two
   * lean aggregate queries instead of loading every StudyProgress row (with
   * its nested Flashcard front/back text) just to bucket and count them —
   * the difference between a handful of integers and a full table scan of
   * card content as a user's review history grows.
   */
  async getDashboardSummary(userId: string): Promise<ProgressSummary> {
    const counts = await this.progressRepository
      .createQueryBuilder('progress')
      .select('COUNT(*)', 'totalTracked')
      .addSelect('COUNT(*) FILTER (WHERE progress."status" = :learning)', 'learningCount')
      .addSelect('COUNT(*) FILTER (WHERE progress."status" = :mastered)', 'masteredCount')
      .addSelect('COUNT(*) FILTER (WHERE progress."next_review_at" <= NOW())', 'dueCount')
      .where('progress."user_id" = :userId', { userId })
      .setParameters({ learning: ProgressStatus.LEARNING, mastered: ProgressStatus.MASTERED })
      .getRawOne<{ totalTracked: string; learningCount: string; masteredCount: string; dueCount: string }>();

    const dueSetRow = await this.progressRepository
      .createQueryBuilder('progress')
      .innerJoin('progress.flashcard', 'flashcard')
      .innerJoin('flashcard.set', 'set')
      .select('set.id', 'setId')
      .addSelect('set.title', 'title')
      .addSelect('COUNT(*)', 'dueCount')
      .where('progress."user_id" = :userId', { userId })
      .andWhere('progress."next_review_at" <= NOW()')
      .groupBy('set.id')
      .addGroupBy('set.title')
      .orderBy('COUNT(*)', 'DESC')
      .limit(1)
      .getRawOne<{ setId: string; title: string; dueCount: string }>();

    return {
      totalTracked: Number(counts?.totalTracked ?? 0),
      learningCount: Number(counts?.learningCount ?? 0),
      masteredCount: Number(counts?.masteredCount ?? 0),
      dueCount: Number(counts?.dueCount ?? 0),
      dueSet: dueSetRow ? { id: dueSetRow.setId, title: dueSetRow.title, dueCount: Number(dueSetRow.dueCount) } : null,
    };
  }

  /**
   * Applies a batch of ratings (one study session's worth) in a single
   * read + single write instead of one SELECT and one INSERT/UPDATE per
   * answer. A typical session's card count made the naive per-answer
   * version a real N+1: up to 2N sequential round trips just to record one
   * completed session. Ratings are folded in-memory in submission order
   * (so a duplicate flashcardId in the same batch still applies both
   * updates in sequence, each building on the last), then written in one
   * transaction — atomic, unlike a loop where a failure partway through
   * would leave only some answers recorded.
   */
  async recordAnswers(userId: string, answers: { flashcardId: string; rating: CardRating }[]): Promise<void> {
    const flashcardIds = [...new Set(answers.map((a) => a.flashcardId))];

    const existing = await this.progressRepository.find({
      where: { user: { id: userId }, flashcard: { id: In(flashcardIds) } },
      relations: { flashcard: true },
    });
    const byFlashcardId = new Map(existing.map((progress) => [progress.flashcard.id, progress]));

    const now = new Date();

    for (const { flashcardId, rating } of answers) {
      let progress = byFlashcardId.get(flashcardId);
      if (!progress) {
        progress = this.progressRepository.create({
          user: { id: userId },
          flashcard: { id: flashcardId },
          status: ProgressStatus.NEW,
          correctCount: 0,
          incorrectCount: 0,
          repetitions: 0,
        });
        byFlashcardId.set(flashcardId, progress);
      }

      const scheduled = scheduleNextReview(progress.repetitions, rating);
      progress.repetitions = scheduled.repetitions;
      progress.intervalDays = scheduled.intervalDays;
      progress.status = scheduled.status;
      progress.correctCount += scheduled.correct ? 1 : 0;
      progress.incorrectCount += scheduled.correct ? 0 : 1;
      progress.lastReviewedAt = now;
      progress.nextReviewAt = addDays(now, scheduled.intervalDays);
    }

    await this.progressRepository.manager.transaction((manager) => manager.save([...byFlashcardId.values()]));
  }
}
