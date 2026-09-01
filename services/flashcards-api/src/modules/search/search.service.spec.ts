import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from './search.service.js';
import { FlashcardSet, SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';
import { CacheService } from '../../redis/cache.service.js';

describe('SearchService', () => {
  let service: SearchService;
  let repo: { findAndCount: ReturnType<typeof vi.fn> };
  let cache: { getJson: ReturnType<typeof vi.fn>; setJson: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repo = { findAndCount: vi.fn().mockResolvedValue([[{ id: 'set-1' }], 1]) };
    cache = { getJson: vi.fn().mockResolvedValue(null), setJson: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(FlashcardSet), useValue: repo },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('queries the database and caches the result on a miss', async () => {
    const result = await service.searchPublicSets({ page: 1, limit: 20, q: 'spanish', category: undefined });

    expect(repo.findAndCount).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [{ id: 'set-1' }], total: 1, page: 1, limit: 20 });
    expect(cache.setJson).toHaveBeenCalledWith(expect.stringContaining('search:spanish'), result, 60);
  });

  it('returns the cached result and skips the database entirely on a hit', async () => {
    const cached = { items: [{ id: 'cached-set' }], total: 1, page: 1, limit: 20 };
    cache.getJson.mockResolvedValue(cached);

    const result = await service.searchPublicSets({ page: 1, limit: 20, q: '', category: undefined });

    expect(result).toBe(cached);
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('keys the cache separately per query/category/page so different searches never collide', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'a', category: undefined });
    await service.searchPublicSets({ page: 2, limit: 20, q: 'a', category: undefined });

    const [keyPage1] = cache.setJson.mock.calls[0];
    const [keyPage2] = cache.setJson.mock.calls[1];
    expect(keyPage1).not.toBe(keyPage2);
  });

  it('only ever queries for PUBLIC sets, regardless of the search term or category — private/unlisted sets must never be discoverable here', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'anything', category: 'english' });

    const [options] = repo.findAndCount.mock.calls[0];
    expect(options.where).toMatchObject({ visibility: SetVisibility.PUBLIC });
  });
});
