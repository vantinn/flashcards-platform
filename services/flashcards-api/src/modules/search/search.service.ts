import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FlashcardSet, SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';
import type { PaginatedResult } from '../../common/dto/pagination.dto.js';
import type { SearchSetsDto } from './dto/search-sets.dto.js';
import { CacheService } from '../../redis/cache.service.js';
import { LikesService } from '../social/likes.service.js';
import { CommentsService } from '../social/comments.service.js';

// Explore is the single most-hit read path in the app — public, identical
// for every visitor per query, and safe to serve a few seconds stale. That
// combination (read-heavy, non-personalized, staleness-tolerant) is exactly
// what a cache-aside TTL earns its keep on; nothing else in this API fits
// that shape as cleanly, so nothing else is cached.
const SEARCH_CACHE_PREFIX = 'search:';
const SEARCH_CACHE_TTL_SECONDS = 60;

interface OwnerSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export type PublicSetSummary = Omit<FlashcardSet, 'creator'> & {
  creator: OwnerSummary;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
};

// The shape actually cached — deliberately excludes likedByCurrentUser,
// which is per-viewer, not per-query, and must never be shared across
// users through the query-keyed cache below.
type CachedSetSummary = Omit<PublicSetSummary, 'likedByCurrentUser'>;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(FlashcardSet)
    private readonly setsRepository: Repository<FlashcardSet>,
    private readonly cache: CacheService,
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
  ) {}

  async searchPublicSets(query: SearchSetsDto, currentUserId: string): Promise<PaginatedResult<PublicSetSummary>> {
    const { page, limit, q, category } = query;
    const cacheKey = `${SEARCH_CACHE_PREFIX}${q ?? ''}:${category ?? ''}:${page}:${limit}`;

    const cached = await this.cache.getJson<PaginatedResult<CachedSetSummary>>(cacheKey);
    const base = cached ?? (await this.loadAndCache(query, cacheKey));

    // Computed fresh on every request, outside the shared cache — this is
    // the one piece of the response that's per-viewer, not per-query.
    const likedSetIds = await this.likesService.likedByUserForSets(
      currentUserId,
      base.items.map((set) => set.id),
    );

    return {
      ...base,
      items: base.items.map((set) => ({ ...set, likedByCurrentUser: likedSetIds.has(set.id) })),
    };
  }

  private async loadAndCache(query: SearchSetsDto, cacheKey: string): Promise<PaginatedResult<CachedSetSummary>> {
    const { page, limit, q, category } = query;

    const [items, total] = await this.setsRepository.findAndCount({
      where: {
        visibility: SetVisibility.PUBLIC,
        ...(q ? { title: ILike(`%${q}%`) } : {}),
        // `category` is the query param name; it filters FlashcardSet.language,
        // the actual column backing the official Set Category — see that
        // entity for why the two concepts share one column.
        ...(category ? { language: category } : {}),
      },
      relations: { creator: true },
      order: { studyCount: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const setIds = items.map((set) => set.id);
    const [likeCounts, commentCounts] = await Promise.all([
      this.likesService.countForSets(setIds),
      this.commentsService.countForSets(setIds),
    ]);

    const result: PaginatedResult<CachedSetSummary> = {
      items: items.map((set) => ({
        ...set,
        // Explicit projection, not the raw entity — this response is cached
        // as plain JSON in Redis, and a value read back from cache is no
        // longer a real `User` class instance, so ClassSerializerInterceptor
        // has no decorator metadata left to strip email/passwordHash/etc
        // from it on a cache hit. Only ever include what's meant to be
        // public regardless of serialization path.
        creator: { id: set.creator.id, displayName: set.creator.displayName, avatarUrl: set.creator.avatarUrl },
        likeCount: likeCounts.get(set.id) ?? 0,
        commentCount: commentCounts.get(set.id) ?? 0,
      })),
      total,
      page,
      limit,
    };

    await this.cache.setJson(cacheKey, result, SEARCH_CACHE_TTL_SECONDS);
    return result;
  }
}
