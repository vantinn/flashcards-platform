import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LikesService } from './likes.service.js';
import { SetLike } from './entities/set-like.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import { FlashcardSet, SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';

function buildSet(overrides: Partial<FlashcardSet> = {}): FlashcardSet {
  return {
    id: 'set-1',
    visibility: SetVisibility.PUBLIC,
    creator: { id: 'owner-1' } as FlashcardSet['creator'],
    ...overrides,
  } as FlashcardSet;
}

describe('LikesService', () => {
  let service: LikesService;
  let repo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  let flashcardSetsService: { findOneVisibleTo: ReturnType<typeof vi.fn>; assertPublicForSocial: ReturnType<typeof vi.fn> };
  let insertExecute: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    insertExecute = vi.fn().mockResolvedValue(undefined);
    const insertBuilder = {
      insert: vi.fn().mockReturnThis(),
      into: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      orIgnore: vi.fn().mockReturnThis(),
      execute: insertExecute,
    };

    repo = {
      createQueryBuilder: vi.fn().mockReturnValue(insertBuilder),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      count: vi.fn().mockResolvedValue(0),
    };

    flashcardSetsService = {
      findOneVisibleTo: vi.fn(),
      assertPublicForSocial: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(SetLike), useValue: repo },
        { provide: FlashcardSetsService, useValue: flashcardSetsService },
      ],
    }).compile();

    service = moduleRef.get(LikesService);
  });

  describe('like', () => {
    it('inserts a like row using insert-or-ignore against the unique (user, set) constraint', async () => {
      flashcardSetsService.assertPublicForSocial.mockResolvedValue(buildSet());
      repo.count.mockResolvedValue(1);

      const result = await service.like('set-1', 'user-1');

      const builder = repo.createQueryBuilder.mock.results[0].value;
      expect(builder.orIgnore).toHaveBeenCalled();
      expect(builder.values).toHaveBeenCalledWith({ user: { id: 'user-1' }, flashcardSet: { id: 'set-1' } });
      expect(result).toEqual({ liked: true, likeCount: 1 });
    });

    it('a duplicate like request is a safe no-op (insert-or-ignore, not a duplicate row)', async () => {
      flashcardSetsService.assertPublicForSocial.mockResolvedValue(buildSet());
      repo.count.mockResolvedValue(1); // still exactly 1 after a second "like" call

      await service.like('set-1', 'user-1');
      const result = await service.like('set-1', 'user-1');

      expect(result.likeCount).toBe(1);
    });

    it('rejects liking a private/unlisted set — assertPublicForSocial is checked before any insert', async () => {
      flashcardSetsService.assertPublicForSocial.mockRejectedValue(new ForbiddenException());

      await expect(service.like('set-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects liking a private set the caller cannot see at all (404, not 403)', async () => {
      flashcardSetsService.assertPublicForSocial.mockRejectedValue(new NotFoundException());

      await expect(service.like('set-1', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('the set owner can like their own public set', async () => {
      flashcardSetsService.assertPublicForSocial.mockResolvedValue(buildSet({ creator: { id: 'owner-1' } as FlashcardSet['creator'] }));
      repo.count.mockResolvedValue(1);

      const result = await service.like('set-1', 'owner-1');

      expect(result.liked).toBe(true);
    });

    it('a non-owner can like a public set', async () => {
      flashcardSetsService.assertPublicForSocial.mockResolvedValue(buildSet());
      repo.count.mockResolvedValue(1);

      const result = await service.like('set-1', 'some-other-user');

      expect(result.liked).toBe(true);
    });
  });

  describe('unlike', () => {
    it('deletes the like row and returns liked: false', async () => {
      flashcardSetsService.assertPublicForSocial.mockResolvedValue(buildSet());
      repo.count.mockResolvedValue(0);

      const result = await service.unlike('set-1', 'user-1');

      expect(repo.delete).toHaveBeenCalledWith({ user: { id: 'user-1' }, flashcardSet: { id: 'set-1' } });
      expect(result).toEqual({ liked: false, likeCount: 0 });
    });

    it('unliking something never liked is a safe no-op, not an error', async () => {
      flashcardSetsService.assertPublicForSocial.mockResolvedValue(buildSet());
      repo.count.mockResolvedValue(0);

      await expect(service.unlike('set-1', 'user-1')).resolves.toEqual({ liked: false, likeCount: 0 });
    });

    it('rejects unliking on a private/unlisted set', async () => {
      flashcardSetsService.assertPublicForSocial.mockRejectedValue(new ForbiddenException());

      await expect(service.unlike('set-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('countForSets / likedByUserForSets', () => {
    it('returns an empty map/set for an empty input without querying', async () => {
      expect(await service.countForSets([])).toEqual(new Map());
      expect(await service.likedByUserForSets('user-1', [])).toEqual(new Set());
    });
  });
});
