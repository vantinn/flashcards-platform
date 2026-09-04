import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentsService } from './comments.service.js';
import { Comment } from './entities/comment.entity.js';
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

function buildComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    content: 'hello',
    user: { id: 'author-1' } as Comment['user'],
    flashcardSet: { id: 'set-1', creator: { id: 'owner-1' } } as Comment['flashcardSet'],
    parentComment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Comment;
}

describe('CommentsService', () => {
  let service: CommentsService;
  let repo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findAndCount: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let flashcardSetsService: { assertPublicForSocial: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repo = {
      create: vi.fn((input) => input),
      save: vi.fn((entity) => Promise.resolve({ id: 'new-comment', ...entity })),
      // Default covers the re-fetch create()/reply() do after saving (to
      // return a fully-hydrated CommentView) — individual tests below
      // override this for the parent-comment-lookup scenarios in reply().
      findOne: vi.fn().mockResolvedValue(buildComment()),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      find: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
      createQueryBuilder: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      }),
    };
    flashcardSetsService = { assertPublicForSocial: vi.fn().mockResolvedValue(buildSet()) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repo },
        { provide: FlashcardSetsService, useValue: flashcardSetsService },
      ],
    }).compile();

    service = moduleRef.get(CommentsService);
  });

  describe('create', () => {
    it('creates a top-level comment (parentComment: null) on a public set', async () => {
      await service.create('set-1', 'user-1', { content: 'nice set!' });

      expect(flashcardSetsService.assertPublicForSocial).toHaveBeenCalledWith('set-1', 'user-1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ flashcardSet: { id: 'set-1' }, user: { id: 'user-1' }, parentComment: null, content: 'nice set!' }),
      );
    });

    it('returns a fully-hydrated CommentView (author + permissions), not the bare entity, so the frontend can render it without a refetch', async () => {
      repo.findOne.mockResolvedValue(
        buildComment({
          user: { id: 'user-1', displayName: 'Commenter', avatarUrl: 'https://x/a.png' } as Comment['user'],
          content: 'nice set!',
        }),
      );

      const result = await service.create('set-1', 'user-1', { content: 'nice set!' });

      expect(result).toMatchObject({
        content: 'nice set!',
        author: { id: 'user-1', displayName: 'Commenter', avatarUrl: 'https://x/a.png' },
        replyCount: 0,
        canEdit: true,
        canDelete: true,
      });
    });

    it('the set owner can comment on their own public set', async () => {
      await service.create('set-1', 'owner-1', { content: 'thanks!' });
      expect(flashcardSetsService.assertPublicForSocial).toHaveBeenCalledWith('set-1', 'owner-1');
    });

    it('rejects commenting on a private/unlisted set', async () => {
      flashcardSetsService.assertPublicForSocial.mockRejectedValue(new ForbiddenException());

      await expect(service.create('set-1', 'user-1', { content: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('reply', () => {
    it('creates a reply referencing the parent comment', async () => {
      repo.findOne.mockResolvedValue(buildComment({ parentComment: null, flashcardSet: { id: 'set-1' } as Comment['flashcardSet'] }));

      await service.reply('set-1', 'comment-1', 'user-2', { content: 'agreed' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentComment: { id: 'comment-1' }, flashcardSet: { id: 'set-1' } }),
      );
    });

    it('rejects a reply whose parent comment does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.reply('set-1', 'missing', 'user-2', { content: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a reply whose parent comment belongs to a different set — cross-set injection guard', async () => {
      repo.findOne.mockResolvedValue(
        buildComment({ parentComment: null, flashcardSet: { id: 'a-different-set' } as Comment['flashcardSet'] }),
      );

      await expect(service.reply('set-1', 'comment-1', 'user-2', { content: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects replying to a reply — V1 supports exactly one level of nesting', async () => {
      repo.findOne.mockResolvedValue(
        buildComment({ parentComment: { id: 'top-level' } as Comment, flashcardSet: { id: 'set-1' } as Comment['flashcardSet'] }),
      );

      await expect(service.reply('set-1', 'comment-1', 'user-2', { content: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects replying on a private/unlisted set', async () => {
      flashcardSetsService.assertPublicForSocial.mockRejectedValue(new ForbiddenException());

      await expect(service.reply('set-1', 'comment-1', 'user-2', { content: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('lets the author edit their own comment and returns the updated CommentView', async () => {
      repo.findOne.mockResolvedValue(buildComment({ user: { id: 'author-1' } as Comment['user'] }));

      const result = await service.update('comment-1', 'author-1', { content: 'edited' });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'edited' }));
      expect(result).toMatchObject({ content: 'edited', canEdit: true });
    });

    it('rejects another user editing someone else\'s comment', async () => {
      repo.findOne.mockResolvedValue(buildComment({ user: { id: 'author-1' } as Comment['user'] }));

      await expect(service.update('comment-1', 'someone-else', { content: 'edited' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('the set owner cannot edit another user\'s comment (moderation allows delete, not edit)', async () => {
      repo.findOne.mockResolvedValue(
        buildComment({ user: { id: 'author-1' } as Comment['user'], flashcardSet: { id: 'set-1', creator: { id: 'owner-1' } } as Comment['flashcardSet'] }),
      );

      await expect(service.update('comment-1', 'owner-1', { content: 'edited' })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('lets the author delete their own comment', async () => {
      repo.findOne.mockResolvedValue(buildComment({ user: { id: 'author-1' } as Comment['user'] }));

      await service.remove('comment-1', 'author-1');

      expect(repo.remove).toHaveBeenCalled();
    });

    it('lets the set owner delete another user\'s comment (moderation)', async () => {
      repo.findOne.mockResolvedValue(
        buildComment({ user: { id: 'author-1' } as Comment['user'], flashcardSet: { id: 'set-1', creator: { id: 'owner-1' } } as Comment['flashcardSet'] }),
      );

      await service.remove('comment-1', 'owner-1');

      expect(repo.remove).toHaveBeenCalled();
    });

    it('rejects an unrelated user (neither author nor set owner) from deleting a comment', async () => {
      repo.findOne.mockResolvedValue(
        buildComment({ user: { id: 'author-1' } as Comment['user'], flashcardSet: { id: 'set-1', creator: { id: 'owner-1' } } as Comment['flashcardSet'] }),
      );

      await expect(service.remove('comment-1', 'random-user')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('rejects deleting a comment that does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findTopLevelForSet', () => {
    it('rejects listing comments on a private/unlisted set', async () => {
      flashcardSetsService.assertPublicForSocial.mockRejectedValue(new ForbiddenException());

      await expect(service.findTopLevelForSet('set-1', 'user-1', { page: 1, limit: 20 })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('marks canEdit/canDelete correctly for the comment author', async () => {
      repo.findAndCount.mockResolvedValue([[buildComment({ user: { id: 'viewer-1', displayName: 'V', avatarUrl: null } as Comment['user'] })], 1]);

      const result = await service.findTopLevelForSet('set-1', 'viewer-1', { page: 1, limit: 20 });

      expect(result.items[0]).toMatchObject({ canEdit: true, canDelete: true });
    });

    it('marks canDelete (moderation) but not canEdit for the set owner viewing someone else\'s comment', async () => {
      repo.findAndCount.mockResolvedValue([
        [buildComment({ user: { id: 'author-1', displayName: 'A', avatarUrl: null } as Comment['user'] })],
        1,
      ]);
      flashcardSetsService.assertPublicForSocial.mockResolvedValue(buildSet({ creator: { id: 'owner-1' } as FlashcardSet['creator'] }));

      const result = await service.findTopLevelForSet('set-1', 'owner-1', { page: 1, limit: 20 });

      expect(result.items[0]).toMatchObject({ canEdit: false, canDelete: true });
    });

    it('marks neither canEdit nor canDelete for an unrelated viewer', async () => {
      repo.findAndCount.mockResolvedValue([
        [buildComment({ user: { id: 'author-1', displayName: 'A', avatarUrl: null } as Comment['user'] })],
        1,
      ]);

      const result = await service.findTopLevelForSet('set-1', 'random-viewer', { page: 1, limit: 20 });

      expect(result.items[0]).toMatchObject({ canEdit: false, canDelete: false });
    });
  });
});
