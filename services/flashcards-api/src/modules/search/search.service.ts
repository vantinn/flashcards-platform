import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FlashcardSet, SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';
import type { PaginatedResult } from '../../common/dto/pagination.dto.js';
import type { SearchSetsDto } from './dto/search-sets.dto.js';
import { CacheService } from '../../redis/cache.service.js';

// Explore is the single most-hit read path in the app — public, identical
// for every visitor per query, and safe to serve a few seconds stale. That
// combination (read-heavy, non-personalized, staleness-tolerant) is exactly
// what a cache-aside TTL earns its keep on; nothing else in this API fits
// that shape as cleanly, so nothing else is cached.
const SEARCH_CACHE_PREFIX = 'search:';
const SEARCH_CACHE_TTL_SECONDS = 60;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(FlashcardSet)
    private readonly setsRepository: Repository<FlashcardSet>,
    private readonly cache: CacheService,
  ) {}

  async searchPublicSets(query: SearchSetsDto): Promise<PaginatedResult<FlashcardSet>> {
    const { page, limit, q, category } = query;
    const cacheKey = `${SEARCH_CACHE_PREFIX}${q ?? ''}:${category ?? ''}:${page}:${limit}`;

    const cached = await this.cache.getJson<PaginatedResult<FlashcardSet>>(cacheKey);
    if (cached) {
      return cached;
    }

    const [items, total] = await this.setsRepository.findAndCount({
      where: {
        visibility: SetVisibility.PUBLIC,
        ...(q ? { title: ILike(`%${q}%`) } : {}),
        // `category` is the query param name; it filters FlashcardSet.language,
        // the actual column backing the official Set Category — see that
        // entity for why the two concepts share one column.
        ...(category ? { language: category } : {}),
      },
      order: { studyCount: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result: PaginatedResult<FlashcardSet> = { items, total, page, limit };
    await this.cache.setJson(cacheKey, result, SEARCH_CACHE_TTL_SECONDS);
    return result;
  }
}
