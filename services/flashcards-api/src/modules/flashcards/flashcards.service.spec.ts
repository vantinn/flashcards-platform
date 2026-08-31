import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlashcardsService } from './flashcards.service.js';
import { Flashcard } from './entities/flashcard.entity.js';
import { SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';

function buildCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-1',
    set: { id: 'set-1', creator: { id: 'owner-1' }, visibility: SetVisibility.PUBLIC } as Flashcard['set'],
    front: 'Front',
    back: 'Back',
    frontImageUrl: null,
    backImageUrl: null,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Flashcard;
}

describe('FlashcardsService', () => {
  let service: FlashcardsService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    manager: { transaction: ReturnType<typeof vi.fn> };
  };
  let flashcardSetsService: { assertOwnership: ReturnType<typeof vi.fn>; incrementCardCount: ReturnType<typeof vi.fn> };
  let queryBuilderExecute: ReturnType<typeof vi.fn>;
  let transactionalSave: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queryBuilderExecute = vi.fn().mockResolvedValue(undefined);
    transactionalSave = vi.fn((entity) => Promise.resolve(entity));
    const transactionalManager = {
      createQueryBuilder: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: queryBuilderExecute,
      })),
      create: vi.fn((_entity, input) => input),
      save: transactionalSave,
    };
    repo = {
      findOne: vi.fn(),
      find: vi.fn(),
      count: vi.fn(),
      create: vi.fn((input) => input),
      save: vi.fn((entity) => Promise.resolve(entity)),
      remove: vi.fn((entity) => Promise.resolve(entity)),
      manager: {
        transaction: vi.fn((work: (manager: typeof transactionalManager) => unknown) => work(transactionalManager)),
      },
    };
    flashcardSetsService = {
      assertOwnership: vi.fn(),
      incrementCardCount: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FlashcardsService,
        { provide: getRepositoryToken(Flashcard), useValue: repo },
        { provide: FlashcardSetsService, useValue: flashcardSetsService },
      ],
    }).compile();

    service = moduleRef.get(FlashcardsService);
  });

  describe('create', () => {
    it('checks set ownership before creating a card', async () => {
      flashcardSetsService.assertOwnership.mockResolvedValue(undefined);
      repo.count.mockResolvedValue(2);

      const card = await service.create('set-1', 'owner-1', { front: 'F', back: 'B' });

      expect(flashcardSetsService.assertOwnership).toHaveBeenCalledWith('set-1', 'owner-1');
      expect(card.position).toBe(2);
      expect(flashcardSetsService.incrementCardCount).toHaveBeenCalledWith('set-1', 1);
    });

    it('propagates the ForbiddenException when the caller does not own the set', async () => {
      flashcardSetsService.assertOwnership.mockRejectedValue(new ForbiddenException());
      await expect(service.create('set-1', 'stranger', { front: 'F', back: 'B' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('rejects a caller who does not own the card set', async () => {
      repo.findOne.mockResolvedValue(buildCard());
      await expect(service.update('card-1', 'someone-else', { front: 'New' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('hides a card in a private set from a non-owner with 404, not 403', async () => {
      repo.findOne.mockResolvedValue(buildCard({ set: { id: 'set-1', creator: { id: 'owner-1' }, visibility: SetVisibility.PRIVATE } as Flashcard['set'] }));
      await expect(service.update('card-1', 'someone-else', { front: 'New' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('applies changes for the owner', async () => {
      repo.findOne.mockResolvedValue(buildCard());
      const result = await service.update('card-1', 'owner-1', { front: 'Updated front' });
      expect(result.front).toBe('Updated front');
    });
  });

  describe('duplicate', () => {
    it('rejects a caller who does not own the card set', async () => {
      repo.findOne.mockResolvedValue(buildCard());
      await expect(service.duplicate('card-1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });

    it('shifts later positions, inserts the copy right after the original, and bumps the card count', async () => {
      repo.findOne.mockResolvedValue(buildCard({ position: 0 }));
      repo.find.mockResolvedValue([buildCard(), buildCard({ id: 'card-1-copy', position: 1 }), buildCard({ id: 'card-2', position: 2 })]);

      const result = await service.duplicate('card-1', 'owner-1');

      expect(queryBuilderExecute).toHaveBeenCalled();
      expect(transactionalSave).toHaveBeenCalledWith(expect.objectContaining({ front: 'Front', back: 'Back', position: 1 }));
      expect(flashcardSetsService.incrementCardCount).toHaveBeenCalledWith('set-1', 1);
      expect(result).toHaveLength(3);
    });
  });

  describe('remove', () => {
    it('rejects a caller who does not own the card set', async () => {
      repo.findOne.mockResolvedValue(buildCard());
      await expect(service.remove('card-1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('decrements the set card count on successful removal', async () => {
      repo.findOne.mockResolvedValue(buildCard());
      await service.remove('card-1', 'owner-1');
      expect(flashcardSetsService.incrementCardCount).toHaveBeenCalledWith('set-1', -1);
    });
  });
});
