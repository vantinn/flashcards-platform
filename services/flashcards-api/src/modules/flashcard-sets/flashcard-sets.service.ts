import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FlashcardSet, SetLanguage, SetVisibility } from './entities/flashcard-set.entity.js';
import { Flashcard } from '../flashcards/entities/flashcard.entity.js';
import type { CreateFlashcardSetDto } from './dto/create-flashcard-set.dto.js';
import type { UpdateFlashcardSetDto } from './dto/update-flashcard-set.dto.js';
import type { MySetsQueryDto } from './dto/my-sets-query.dto.js';
import type { PaginatedResult } from '../../common/dto/pagination.dto.js';
import { CacheService } from '../../redis/cache.service.js';

@Injectable()
export class FlashcardSetsService {
  constructor(
    @InjectRepository(FlashcardSet)
    private readonly setsRepository: Repository<FlashcardSet>,
    private readonly cache: CacheService,
  ) {}

  async create(creatorId: string, dto: CreateFlashcardSetDto): Promise<FlashcardSet> {
    const set = this.setsRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      visibility: dto.visibility ?? SetVisibility.PRIVATE,
      language: dto.language ?? SetLanguage.FREE,
      creator: { id: creatorId },
    });
    const saved = await this.setsRepository.save(set);
    await this.invalidateSearchCache();
    return saved;
  }

  /**
   * Bounded and filterable by design — a user's own library is still just
   * a search over one table, and every other list in this API (Explore)
   * already pays that cost, so there's no reason this one should hand back
   * every row unfiltered.
   */
  async findAllForUser(userId: string, query: MySetsQueryDto): Promise<PaginatedResult<FlashcardSet>> {
    const { page, limit, q, visibility } = query;

    const [items, total] = await this.setsRepository.findAndCount({
      where: {
        creator: { id: userId },
        ...(q ? { title: ILike(`%${q}%`) } : {}),
        ...(visibility ? { visibility } : {}),
      },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async findOneOrFail(id: string): Promise<FlashcardSet> {
    const set = await this.setsRepository.findOne({
      where: { id },
      relations: { creator: true, cards: true },
    });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    return set;
  }

  /**
   * Enforces visibility rather than just existence: a private set is only
   * visible to its creator. Non-owners (including anonymous callers) get a
   * 404 rather than a 403 so a private set's existence isn't confirmed to
   * people who can't see it. Public and unlisted sets are open to anyone —
   * "unlisted" only means it's excluded from search, not access-controlled.
   */
  async findOneVisibleTo(id: string, userId: string | undefined): Promise<FlashcardSet> {
    const set = await this.findOneOrFail(id);
    if (set.visibility === SetVisibility.PRIVATE && set.creator.id !== userId) {
      throw new NotFoundException('Flashcard set not found');
    }
    return set;
  }

  /**
   * Same 404-before-403 ordering as findOneVisibleTo, for the same reason:
   * a private set owned by someone else must 404, not 403 — a 403 here
   * would still confirm the set exists to a caller who can't even see it.
   * A public/unlisted set owned by someone else is a real 403, since its
   * existence is already visible to that caller.
   */
  async assertOwnership(id: string, userId: string): Promise<FlashcardSet> {
    const set = await this.findOneOrFail(id);
    if (set.visibility === SetVisibility.PRIVATE && set.creator.id !== userId) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.creator.id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }
    return set;
  }

  async update(id: string, userId: string, dto: UpdateFlashcardSetDto): Promise<FlashcardSet> {
    const set = await this.assertOwnership(id, userId);
    Object.assign(set, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
    });
    const saved = await this.setsRepository.save(set);
    await this.invalidateSearchCache();
    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const set = await this.assertOwnership(id, userId);
    await this.setsRepository.remove(set);
    await this.invalidateSearchCache();
  }

  /**
   * Only called from create/update/remove — title, language (the official
   * Set Category), and visibility are the only fields Explore's search can
   * filter or match on. incrementStudyCount() deliberately does NOT
   * invalidate: it only
   * shifts ordering (most-studied-first), fires on every completed study
   * session, and a cache that gets flushed that often stops caching
   * anything. A stale ordering for up to the cache's TTL is a fine
   * trade-off there; a stale set that a viewer just made private, or that
   * no longer exists, is not.
   */
  private invalidateSearchCache(): Promise<void> {
    return this.cache.deleteByPrefix('search:');
  }

  /**
   * Copies a set (and all its cards) into the caller's own library.
   * Owner-only, same as update()/remove() — a public set can be studied by
   * anyone but only its creator may derive a copy from it. Always lands as
   * private regardless of the source's visibility: a copy shouldn't
   * silently become public just because the original was.
   *
   * The set row and its cards are written in one transaction — without
   * that, a crash or failed write between the two save() calls would leave
   * a set whose cardCount says N but that actually has zero cards.
   */
  async duplicate(id: string, userId: string): Promise<FlashcardSet> {
    const source = await this.assertOwnership(id, userId);
    const sortedCards = [...source.cards].sort((a, b) => a.position - b.position);

    const copy = await this.setsRepository.manager.transaction(async (manager) => {
      const savedSet = await manager.save(
        manager.create(FlashcardSet, {
          title: `${source.title} (copy)`,
          description: source.description,
          language: source.language,
          visibility: SetVisibility.PRIVATE,
          creator: { id: userId },
          cardCount: sortedCards.length,
        }),
      );

      if (sortedCards.length > 0) {
        await manager.save(
          sortedCards.map((card, position) =>
            manager.create(Flashcard, {
              set: { id: savedSet.id },
              front: card.front,
              back: card.back,
              frontImageUrl: card.frontImageUrl,
              backImageUrl: card.backImageUrl,
              position,
            }),
          ),
        );
      }

      return savedSet;
    });

    return copy;
  }

  async incrementCardCount(id: string, delta: number): Promise<void> {
    await this.setsRepository.increment({ id }, 'cardCount', delta);
  }

  async incrementStudyCount(id: string): Promise<void> {
    await this.setsRepository.increment({ id }, 'studyCount', 1);
  }
}
