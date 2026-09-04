import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SetLike } from './entities/set-like.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';

export interface LikeState {
  liked: boolean;
  likeCount: number;
}

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(SetLike)
    private readonly likesRepository: Repository<SetLike>,
    private readonly flashcardSetsService: FlashcardSetsService,
  ) {}

  /**
   * Insert-or-ignore against the (user, set) unique constraint — the actual
   * duplicate guard is the database, not a "check then insert" here, so a
   * double-click, two open tabs, or a retry after a lost response all
   * converge on exactly one row with no race condition.
   */
  async like(setId: string, userId: string): Promise<LikeState> {
    await this.flashcardSetsService.assertPublicForSocial(setId, userId);

    await this.likesRepository
      .createQueryBuilder()
      .insert()
      .into(SetLike)
      .values({ user: { id: userId }, flashcardSet: { id: setId } })
      .orIgnore()
      .execute();

    return { liked: true, likeCount: await this.countForSet(setId) };
  }

  /** Idempotent — unliking something already unliked is not an error. */
  async unlike(setId: string, userId: string): Promise<LikeState> {
    await this.flashcardSetsService.assertPublicForSocial(setId, userId);

    await this.likesRepository.delete({ user: { id: userId }, flashcardSet: { id: setId } });

    return { liked: false, likeCount: await this.countForSet(setId) };
  }

  private countForSet(setId: string): Promise<number> {
    return this.likesRepository.count({ where: { flashcardSet: { id: setId } } });
  }

  /** Batched — one grouped query for a whole page of sets, not one per set. */
  async countForSets(setIds: string[]): Promise<Map<string, number>> {
    if (setIds.length === 0) return new Map();

    const rows = await this.likesRepository
      .createQueryBuilder('like')
      .select('like.flashcard_set_id', 'setId')
      .addSelect('COUNT(*)', 'count')
      .where('like.flashcard_set_id IN (:...setIds)', { setIds })
      .groupBy('like.flashcard_set_id')
      .getRawMany<{ setId: string; count: string }>();

    return new Map(rows.map((row) => [row.setId, Number(row.count)]));
  }

  /** Batched — one query for a whole page of sets, not one per set. */
  async likedByUserForSets(userId: string, setIds: string[]): Promise<Set<string>> {
    if (setIds.length === 0) return new Set();

    const rows = await this.likesRepository
      .createQueryBuilder('like')
      .select('like.flashcard_set_id', 'setId')
      .where('like.user_id = :userId', { userId })
      .andWhere('like.flashcard_set_id IN (:...setIds)', { setIds })
      .getRawMany<{ setId: string }>();

    return new Set(rows.map((row) => row.setId));
  }
}
