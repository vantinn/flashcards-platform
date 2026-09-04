import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlashcardSetsService } from './flashcard-sets.service.js';
import { FlashcardSet, SetLanguage, SetVisibility } from './entities/flashcard-set.entity.js';
import { Flashcard } from '../flashcards/entities/flashcard.entity.js';
import { CacheService } from '../../redis/cache.service.js';

function buildSet(overrides: Partial<FlashcardSet> = {}): FlashcardSet {
  return {
    id: 'set-1',
    title: 'Sample Set',
    description: null,
    coverImageUrl: null,
    creator: { id: 'owner-1' } as FlashcardSet['creator'],
    language: SetLanguage.FREE,
    visibility: SetVisibility.PRIVATE,
    cardCount: 0,
    studyCount: 0,
    cards: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlashcardSet;
}

describe('FlashcardSetsService', () => {
  let service: FlashcardSetsService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    findAndCount: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    manager: { transaction: ReturnType<typeof vi.fn> };
  };
  let cache: { deleteByPrefix: ReturnType<typeof vi.fn> };
  let transactionManager: { create: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    transactionManager = {
      create: vi.fn((_entity, input) => input),
      save: vi.fn((entityOrArray) =>
        Promise.resolve(Array.isArray(entityOrArray) ? entityOrArray : { id: 'set-copy', ...entityOrArray }),
      ),
    };
    repo = {
      findOne: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      create: vi.fn((input) => input),
      save: vi.fn((entity) => Promise.resolve({ id: 'set-copy', ...entity })),
      remove: vi.fn((entity) => Promise.resolve(entity)),
      manager: { transaction: vi.fn((work: (manager: typeof transactionManager) => unknown) => work(transactionManager)) },
    };
    cache = { deleteByPrefix: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FlashcardSetsService,
        { provide: getRepositoryToken(FlashcardSet), useValue: repo },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(FlashcardSetsService);
  });

  describe('findOneVisibleTo', () => {
    it('lets the owner see their own private set', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PRIVATE }));
      const result = await service.findOneVisibleTo('set-1', 'owner-1');
      expect(result.id).toBe('set-1');
    });

    it('hides a private set from a non-owner (404, not 403)', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PRIVATE }));
      await expect(service.findOneVisibleTo('set-1', 'someone-else')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('hides a private set from an anonymous caller', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PRIVATE }));
      await expect(service.findOneVisibleTo('set-1', undefined)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets anyone see a public set', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PUBLIC }));
      const result = await service.findOneVisibleTo('set-1', undefined);
      expect(result.id).toBe('set-1');
    });

    it('lets anyone see an unlisted set (accessible via link, just not searchable)', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.UNLISTED }));
      const result = await service.findOneVisibleTo('set-1', 'anyone');
      expect(result.id).toBe('set-1');
    });

    it('throws NotFoundException when the set does not exist at all', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOneVisibleTo('missing', 'owner-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertOwnership', () => {
    it('passes for the owner', async () => {
      repo.findOne.mockResolvedValue(buildSet());
      await expect(service.assertOwnership('set-1', 'owner-1')).resolves.toBeDefined();
    });

    it('hides a private set from a non-owner with 404, not 403 — a 403 would still confirm it exists', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PRIVATE }));
      await expect(service.assertOwnership('set-1', 'someone-else')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a non-owner of a PUBLIC set with 403 — its existence is already visible to them', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PUBLIC }));
      await expect(service.assertOwnership('set-1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create', () => {
    it('defaults to private visibility and invalidates the search cache', async () => {
      const result = await service.create('owner-1', { title: 'New Set' });
      expect(result.visibility).toBe(SetVisibility.PRIVATE);
      expect(result.creator).toEqual({ id: 'owner-1' });
      expect(cache.deleteByPrefix).toHaveBeenCalledWith('search:');
    });

    it('defaults language to FREE when not provided', async () => {
      const result = await service.create('owner-1', { title: 'New Set' });
      expect(result.language).toBe(SetLanguage.FREE);
    });

    it('persists an explicit language', async () => {
      const result = await service.create('owner-1', { title: 'New Set', language: SetLanguage.ENGLISH });
      expect(result.language).toBe(SetLanguage.ENGLISH);
    });
  });

  describe('update / remove', () => {
    it('invalidates the search cache on update', async () => {
      repo.findOne.mockResolvedValue(buildSet());
      await service.update('set-1', 'owner-1', { title: 'Renamed' });
      expect(cache.deleteByPrefix).toHaveBeenCalledWith('search:');
    });

    it('invalidates the search cache on remove', async () => {
      repo.findOne.mockResolvedValue(buildSet());
      await service.remove('set-1', 'owner-1');
      expect(cache.deleteByPrefix).toHaveBeenCalledWith('search:');
    });

    it('changes language on an existing set', async () => {
      repo.findOne.mockResolvedValue(buildSet({ language: SetLanguage.FREE }));
      const result = await service.update('set-1', 'owner-1', { language: SetLanguage.CHINESE });
      expect(result.language).toBe(SetLanguage.CHINESE);
    });

    it('leaves language unchanged when not included in the update payload', async () => {
      repo.findOne.mockResolvedValue(buildSet({ language: SetLanguage.ENGLISH }));
      const result = await service.update('set-1', 'owner-1', { title: 'Renamed' });
      expect(result.language).toBe(SetLanguage.ENGLISH);
    });
  });

  describe('findAllForUser', () => {
    it('scopes to the caller, paginates, and filters by q/visibility', async () => {
      // Built once and reused for both the mock and the expectation — two
      // separate buildSet() calls each mint their own `new Date()` for
      // createdAt/updatedAt, which are usually equal to the millisecond but
      // occasionally aren't under load, making the assertion below flaky.
      const set = buildSet();
      repo.findAndCount.mockResolvedValue([[set], 1]);

      const result = await service.findAllForUser('owner-1', { page: 2, limit: 10, q: 'span', visibility: SetVisibility.PUBLIC });

      expect(result).toEqual({ items: [set], total: 1, page: 2, limit: 10 });
      const [options] = repo.findAndCount.mock.calls[0];
      expect(options.where).toMatchObject({ creator: { id: 'owner-1' }, visibility: SetVisibility.PUBLIC });
      expect(options.skip).toBe(10); // (page 2 - 1) * limit 10
      expect(options.take).toBe(10);
    });
  });

  describe('duplicate', () => {
    it('copies the owner\'s own set and all of its cards into their library as private, in one transaction', async () => {
      repo.findOne.mockResolvedValue(
        buildSet({
          visibility: SetVisibility.PUBLIC,
          title: 'Spanish Basics',
          language: SetLanguage.ENGLISH,
          cards: [
            { id: 'card-2', position: 1, front: 'Gracias', back: 'Thank you' } as Flashcard,
            { id: 'card-1', position: 0, front: 'Hola', back: 'Hello' } as Flashcard,
          ],
        }),
      );

      const result = await service.duplicate('set-1', 'owner-1');

      expect(repo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(result.title).toBe('Spanish Basics (copy)');
      expect(result.visibility).toBe(SetVisibility.PRIVATE);
      expect(result.language).toBe(SetLanguage.ENGLISH);
      expect(result.creator).toEqual({ id: 'owner-1' });

      // Second save() call inside the transaction is the cards array.
      const [savedCards] = transactionManager.save.mock.calls[1];
      expect(savedCards).toHaveLength(2);
      // Re-sequenced by source position (0, 1, ...), not insertion order.
      expect(savedCards[0]).toMatchObject({ front: 'Hola', position: 0 });
      expect(savedCards[1]).toMatchObject({ front: 'Gracias', position: 1 });
    });

    it('rejects duplicating a private set the caller cannot see', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PRIVATE }));
      await expect(service.duplicate('set-1', 'someone-else')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects duplicating a public set the caller does not own', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PUBLIC }));
      await expect(service.duplicate('set-1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });

    it('skips the cards write entirely for an empty set', async () => {
      repo.findOne.mockResolvedValue(buildSet({ visibility: SetVisibility.PUBLIC, cards: [] }));
      await service.duplicate('set-1', 'owner-1');
      expect(transactionManager.save).toHaveBeenCalledTimes(1); // just the set, no cards call
    });
  });
});
