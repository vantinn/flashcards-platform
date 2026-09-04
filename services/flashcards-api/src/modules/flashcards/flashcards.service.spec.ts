import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlashcardsService } from './flashcards.service.js';
import { Flashcard } from './entities/flashcard.entity.js';
import { SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';

const DEFAULT_MAX_BULK_IMPORT = 500;

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
    const configService = {
      get: vi.fn((key: string) => (key === 'flashcards.maxBulkImport' ? DEFAULT_MAX_BULK_IMPORT : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FlashcardsService,
        { provide: getRepositoryToken(Flashcard), useValue: repo },
        { provide: FlashcardSetsService, useValue: flashcardSetsService },
        { provide: ConfigService, useValue: configService },
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

  describe('bulkCreate', () => {
    beforeEach(() => {
      flashcardSetsService.assertOwnership.mockResolvedValue(undefined);
      repo.find.mockResolvedValue([]); // no existing cards in the set, by default
      repo.count.mockResolvedValue(0); // starting position, by default
    });

    it('checks set ownership before importing anything', async () => {
      flashcardSetsService.assertOwnership.mockRejectedValue(new ForbiddenException());

      await expect(service.bulkCreate('set-1', 'stranger', { cards: [{ front: 'a', back: 'b' }] })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects a payload larger than the configured maximum, without touching the database', async () => {
      const tooMany = Array.from({ length: DEFAULT_MAX_BULK_IMPORT + 1 }, (_, i) => ({ front: `f${i}`, back: `b${i}` }));

      await expect(service.bulkCreate('set-1', 'owner-1', { cards: tooMany })).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });

    it('imports all rows in one transaction with a single batched save call, at sequential positions after the existing cards', async () => {
      repo.count.mockResolvedValue(3); // 3 cards already in the set
      const cards = [
        { front: 'hello', back: 'xin chào' },
        { front: 'world', back: 'thế giới' },
      ];

      const result = await service.bulkCreate('set-1', 'owner-1', { cards });

      expect(transactionalSave).toHaveBeenCalledTimes(1); // one batched call, not one per row
      const savedArg = transactionalSave.mock.calls[0][0];
      expect(savedArg).toHaveLength(2);
      expect(savedArg[0]).toMatchObject({ front: 'hello', back: 'xin chào', position: 3 });
      expect(savedArg[1]).toMatchObject({ front: 'world', back: 'thế giới', position: 4 });
      expect(result.importedCount).toBe(2);
      expect(result.totalReceived).toBe(2);
      expect(result.duplicateCount).toBe(0);
      expect(flashcardSetsService.incrementCardCount).toHaveBeenCalledWith('set-1', 2);
    });

    it('trims whitespace from front/back before saving', async () => {
      await service.bulkCreate('set-1', 'owner-1', { cards: [{ front: '  hello  ', back: '  xin chào  ' }] });

      const savedArg = transactionalSave.mock.calls[0][0];
      expect(savedArg[0]).toMatchObject({ front: 'hello', back: 'xin chào' });
    });

    it('skips a row that duplicates an earlier row in the same pasted batch, and reports it', async () => {
      const cards = [
        { front: 'hello', back: 'xin chào' },
        { front: 'world', back: 'thế giới' },
        { front: 'hello', back: 'xin chào' }, // exact repeat
        { front: '  hello  ', back: '  xin chào  ' }, // repeat after trimming
      ];

      const result = await service.bulkCreate('set-1', 'owner-1', { cards });

      const savedArg = transactionalSave.mock.calls[0][0];
      expect(savedArg).toHaveLength(2);
      expect(result.importedCount).toBe(2);
      expect(result.duplicateCount).toBe(2);
      expect(result.totalReceived).toBe(4);
    });

    it('skips a row that duplicates a card already in the set, without touching the existing card', async () => {
      repo.find.mockResolvedValue([{ front: 'hello', back: 'xin chào' }]);

      const result = await service.bulkCreate('set-1', 'owner-1', {
        cards: [
          { front: 'hello', back: 'xin chào' },
          { front: 'world', back: 'thế giới' },
        ],
      });

      const savedArg = transactionalSave.mock.calls[0][0];
      expect(savedArg).toHaveLength(1);
      expect(savedArg[0]).toMatchObject({ front: 'world' });
      expect(result.importedCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
    });

    it('does not treat front="a b"+back="c" as a duplicate of front="a"+back="b c"', async () => {
      const result = await service.bulkCreate('set-1', 'owner-1', {
        cards: [
          { front: 'a b', back: 'c' },
          { front: 'a', back: 'b c' },
        ],
      });

      expect(result.importedCount).toBe(2);
      expect(result.duplicateCount).toBe(0);
    });

    it('imports every card belonging to the correct set (never a different one from the URL)', async () => {
      await service.bulkCreate('set-1', 'owner-1', { cards: [{ front: 'a', back: 'b' }] });

      const savedArg = transactionalSave.mock.calls[0][0];
      expect(savedArg[0].set).toEqual({ id: 'set-1' });
    });

    it('when every row is a duplicate, saves nothing and never calls incrementCardCount', async () => {
      repo.find.mockResolvedValue([{ front: 'hello', back: 'xin chào' }]);

      const result = await service.bulkCreate('set-1', 'owner-1', { cards: [{ front: 'hello', back: 'xin chào' }] });

      expect(transactionalSave).not.toHaveBeenCalled();
      expect(flashcardSetsService.incrementCardCount).not.toHaveBeenCalled();
      expect(result).toEqual({ cards: [], totalReceived: 1, importedCount: 0, duplicateCount: 1 });
    });
  });
});
