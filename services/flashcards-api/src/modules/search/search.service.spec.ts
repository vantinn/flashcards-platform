import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from './search.service.js';
import { FlashcardSet, SetLanguage, SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';
import { CacheService } from '../../redis/cache.service.js';
import { LikesService } from '../social/likes.service.js';
import { CommentsService } from '../social/comments.service.js';

const CURRENT_USER_ID = 'viewer-1';

/** Mirrors SearchService's key builder — asserted against, never imported, so a silent change to either is caught. */
function termHash(term: string): string {
  return createHash('sha256').update(term).digest('hex').slice(0, 16);
}

function buildSetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'set-1',
    creator: { id: 'owner-1', displayName: 'Owner', avatarUrl: null, email: 'owner@example.com' },
    ...overrides,
  };
}

describe('SearchService', () => {
  let service: SearchService;
  let repo: { findAndCount: ReturnType<typeof vi.fn> };
  let cache: { getJson: ReturnType<typeof vi.fn>; setJson: ReturnType<typeof vi.fn> };
  let likesService: { countForSets: ReturnType<typeof vi.fn>; likedByUserForSets: ReturnType<typeof vi.fn> };
  let commentsService: { countForSets: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repo = { findAndCount: vi.fn().mockResolvedValue([[buildSetRow()], 1]) };
    cache = { getJson: vi.fn().mockResolvedValue(null), setJson: vi.fn().mockResolvedValue(undefined) };
    likesService = {
      countForSets: vi.fn().mockResolvedValue(new Map()),
      likedByUserForSets: vi.fn().mockResolvedValue(new Set()),
    };
    commentsService = { countForSets: vi.fn().mockResolvedValue(new Map()) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(FlashcardSet), useValue: repo },
        { provide: CacheService, useValue: cache },
        { provide: LikesService, useValue: likesService },
        { provide: CommentsService, useValue: commentsService },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('queries the database and caches the result on a miss', async () => {
    const result = await service.searchPublicSets(
      { page: 1, limit: 20, q: 'spanish', category: undefined },
      CURRENT_USER_ID,
    );

    expect(repo.findAndCount).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'set-1', likeCount: 0, commentCount: 0, likedByCurrentUser: false }),
    ]);
    const [key, , ttl] = cache.setJson.mock.calls[0];
    expect(key).toBe(`search:v1:any:1:20:${termHash('spanish')}`);
    expect(ttl).toBe(60);
  });

  it('never caches the owner\'s email — only the safe id/displayName/avatarUrl projection', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: '', category: undefined }, CURRENT_USER_ID);

    const [, cachedPayload] = cache.setJson.mock.calls[0];
    expect(cachedPayload.items[0].creator).toEqual({ id: 'owner-1', displayName: 'Owner', avatarUrl: null });
  });

  it('returns the cached result and skips the database entirely on a hit', async () => {
    const cached = {
      items: [{ id: 'cached-set', creator: { id: 'o', displayName: 'O', avatarUrl: null }, likeCount: 3, commentCount: 2 }],
      total: 1,
      page: 1,
      limit: 20,
    };
    cache.getJson.mockResolvedValue(cached);

    const result = await service.searchPublicSets({ page: 1, limit: 20, q: '', category: undefined }, CURRENT_USER_ID);

    expect(repo.findAndCount).not.toHaveBeenCalled();
    expect(result.items[0]).toMatchObject({ id: 'cached-set', likeCount: 3, commentCount: 2, likedByCurrentUser: false });
  });

  it('computes likedByCurrentUser per request, never from the shared query-keyed cache', async () => {
    const cached = {
      items: [{ id: 'set-1', creator: { id: 'o', displayName: 'O', avatarUrl: null }, likeCount: 1, commentCount: 0 }],
      total: 1,
      page: 1,
      limit: 20,
    };
    cache.getJson.mockResolvedValue(cached);
    likesService.likedByUserForSets.mockResolvedValue(new Set(['set-1']));

    const result = await service.searchPublicSets({ page: 1, limit: 20, q: '', category: undefined }, CURRENT_USER_ID);

    expect(likesService.likedByUserForSets).toHaveBeenCalledWith(CURRENT_USER_ID, ['set-1']);
    expect(result.items[0].likedByCurrentUser).toBe(true);
  });

  it('keys the cache separately per query/category/page/limit so different searches never collide', async () => {
    const variants = [
      { page: 1, limit: 20, q: 'a', category: undefined },
      { page: 2, limit: 20, q: 'a', category: undefined },
      { page: 1, limit: 50, q: 'a', category: undefined },
      { page: 1, limit: 20, q: 'b', category: undefined },
      { page: 1, limit: 20, q: 'a', category: SetLanguage.ENGLISH },
      { page: 1, limit: 20, q: 'a', category: SetLanguage.CHINESE },
      { page: 1, limit: 20, q: undefined, category: undefined },
    ];

    for (const variant of variants) {
      await service.searchPublicSets(variant, CURRENT_USER_ID);
    }

    const keys = cache.setJson.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(new Set(keys).size).toBe(variants.length);
  });

  // A term containing the key delimiter must not be able to shift the
  // remaining segments and alias another query's cache entry — the reason
  // the free-text part is hashed rather than interpolated.
  it('cannot be made to collide by embedding the key delimiter in the search term', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'english', category: undefined }, CURRENT_USER_ID);
    await service.searchPublicSets({ page: 1, limit: 20, q: '', category: SetLanguage.ENGLISH }, CURRENT_USER_ID);
    await service.searchPublicSets({ page: 1, limit: 20, q: 'x:english:1:20', category: undefined }, CURRENT_USER_ID);

    const keys = cache.setJson.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(new Set(keys).size).toBe(3);
  });

  it('bounds key length regardless of how long the search term is', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'x'.repeat(200), category: undefined }, CURRENT_USER_ID);

    const [key] = cache.setJson.mock.calls[0];
    expect(key.length).toBeLessThan(64);
  });

  it('versions the key so a payload-shape change cannot read back an older deploy\'s value', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'a', category: undefined }, CURRENT_USER_ID);

    const [key] = cache.setJson.mock.calls[0];
    expect(key.startsWith('search:v1:')).toBe(true);
  });

  // The cache is shared across every viewer, which is only safe because the
  // stored value is viewer-independent. If a user id ever appears in the key
  // that invariant has been broken in one direction; if viewer-specific data
  // ever appears in the value, in the other.
  it('never puts viewer identity in the cache key', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'a', category: undefined }, CURRENT_USER_ID);

    const [key] = cache.setJson.mock.calls[0];
    expect(key).not.toContain(CURRENT_USER_ID);
  });

  it('never puts viewer-specific state in the cached value', async () => {
    likesService.likedByUserForSets.mockResolvedValue(new Set(['set-1']));

    await service.searchPublicSets({ page: 1, limit: 20, q: 'a', category: undefined }, CURRENT_USER_ID);

    const [, cachedPayload] = cache.setJson.mock.calls[0];
    expect(cachedPayload.items[0]).not.toHaveProperty('likedByCurrentUser');
  });

  // User A must never see User B's like state through the shared entry.
  it('serves one cached entry to two viewers with each viewer\'s own like state', async () => {
    const cached = {
      items: [{ id: 'set-1', creator: { id: 'o', displayName: 'O', avatarUrl: null }, likeCount: 1, commentCount: 0 }],
      total: 1,
      page: 1,
      limit: 20,
    };
    cache.getJson.mockResolvedValue(cached);

    likesService.likedByUserForSets.mockResolvedValueOnce(new Set(['set-1']));
    const viewerA = await service.searchPublicSets({ page: 1, limit: 20, q: 'a', category: undefined }, 'user-a');

    likesService.likedByUserForSets.mockResolvedValueOnce(new Set());
    const viewerB = await service.searchPublicSets({ page: 1, limit: 20, q: 'a', category: undefined }, 'user-b');

    expect(viewerA.items[0].likedByCurrentUser).toBe(true);
    expect(viewerB.items[0].likedByCurrentUser).toBe(false);
  });

  // A Redis outage surfaces here as a permanent miss — CacheService absorbs
  // the error and returns null (see cache.service.spec.ts). Explore must
  // stay fully functional in that state, just uncached.
  it('serves complete results from PostgreSQL when Redis is unavailable', async () => {
    cache.getJson.mockResolvedValue(null);

    const result = await service.searchPublicSets(
      { page: 1, limit: 20, q: 'a', category: undefined },
      CURRENT_USER_ID,
    );

    expect(repo.findAndCount).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'set-1', likeCount: 0, commentCount: 0, likedByCurrentUser: false }),
    ]);
  });

  it('only ever queries for PUBLIC sets, regardless of the search term or category — private/unlisted sets must never be discoverable here', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'anything', category: SetLanguage.ENGLISH }, CURRENT_USER_ID);

    const [options] = repo.findAndCount.mock.calls[0];
    expect(options.where).toMatchObject({ visibility: SetVisibility.PUBLIC });
  });

  it('filters on the official Set Category (FlashcardSet.language) when one is given', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: '', category: SetLanguage.CHINESE }, CURRENT_USER_ID);

    const [options] = repo.findAndCount.mock.calls[0];
    expect(options.where).toMatchObject({ language: SetLanguage.CHINESE });
  });

  it('applies no category restriction when none is given', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: '', category: undefined }, CURRENT_USER_ID);

    const [options] = repo.findAndCount.mock.calls[0];
    expect(options.where).not.toHaveProperty('language');
  });

  it('composes the search term and category into one AND-ed query', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: 'HSK', category: SetLanguage.CHINESE }, CURRENT_USER_ID);

    const [options] = repo.findAndCount.mock.calls[0];
    expect(options.where).toMatchObject({
      visibility: SetVisibility.PUBLIC,
      language: SetLanguage.CHINESE,
    });
    expect(options.where.title).toBeDefined(); // the ILike('%HSK%') condition
  });

  it('loads the creator relation so owner avatar/name can be shown', async () => {
    await service.searchPublicSets({ page: 1, limit: 20, q: '', category: undefined }, CURRENT_USER_ID);

    const [options] = repo.findAndCount.mock.calls[0];
    expect(options.relations).toEqual({ creator: true });
  });
});
