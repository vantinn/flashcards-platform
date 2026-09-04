import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flashcard } from './entities/flashcard.entity.js';
import { SetVisibility } from '../flashcard-sets/entities/flashcard-set.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import type { CreateFlashcardDto } from './dto/create-flashcard.dto.js';
import type { UpdateFlashcardDto } from './dto/update-flashcard.dto.js';
import type { ReorderFlashcardsDto } from './dto/reorder-flashcards.dto.js';
import type { BulkCreateFlashcardsDto } from './dto/bulk-create-flashcards.dto.js';

export interface BulkCreateResult {
  cards: Flashcard[];
  totalReceived: number;
  importedCount: number;
  duplicateCount: number;
}

/**
 * front+back, trimmed — the same pair (case-sensitive) is what "duplicate"
 * means for bulk import. Joined with an escaped NUL character (never
 * legitimately typed by a user) rather than a plain space, so front="a b"
 * + back="c" can never collide with front="a" + back="b c".
 */
function duplicateKey(front: string, back: string): string {
  return `${front.trim()}\u0000${back.trim()}`;
}

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardsRepository: Repository<Flashcard>,
    private readonly flashcardSetsService: FlashcardSetsService,
    private readonly configService: ConfigService,
  ) {}

  findBySet(setId: string): Promise<Flashcard[]> {
    return this.flashcardsRepository.find({
      where: { set: { id: setId } },
      order: { position: 'ASC' },
    });
  }

  async create(setId: string, userId: string, dto: CreateFlashcardDto): Promise<Flashcard> {
    await this.flashcardSetsService.assertOwnership(setId, userId);

    const existingCount = await this.flashcardsRepository.count({ where: { set: { id: setId } } });

    const card = this.flashcardsRepository.create({
      set: { id: setId },
      front: dto.front,
      back: dto.back,
      frontImageUrl: dto.frontImageUrl ?? null,
      backImageUrl: dto.backImageUrl ?? null,
      position: existingCount,
    });

    const saved = await this.flashcardsRepository.save(card);
    await this.flashcardSetsService.incrementCardCount(setId, 1);
    return saved;
  }

  /**
   * Bulk Add Flashcards (copy/paste import). Follows the exact same
   * ownership/position/business rules as create() — front/back validation
   * already happened at the DTO layer (BulkFlashcardItemDto mirrors
   * CreateFlashcardDto exactly), so this only adds what's specific to
   * importing many rows at once: the configurable size ceiling, duplicate
   * detection, and a single batched transactional insert instead of N
   * separate writes.
   *
   * Duplicates (case-sensitive, trimmed front+back) are skipped rather than
   * rejecting the whole request — this codebase has no uniqueness
   * constraint on Flashcard.front/back today (manually creating the same
   * card twice already works), so bulk import can't invent a stricter
   * policy; it only protects against the specific failure mode a paste
   * naturally invites (accidentally copying the same two rows twice). The
   * skip is never silent — see BulkCreateResult's duplicateCount.
   */
  async bulkCreate(setId: string, userId: string, dto: BulkCreateFlashcardsDto): Promise<BulkCreateResult> {
    await this.flashcardSetsService.assertOwnership(setId, userId);

    const maxBulkImport = this.configService.get<number>('flashcards.maxBulkImport')!;
    if (dto.cards.length > maxBulkImport) {
      throw new BadRequestException(`A bulk import can contain at most ${maxBulkImport} cards.`);
    }

    const existingCards = await this.flashcardsRepository.find({
      where: { set: { id: setId } },
      select: { front: true, back: true },
    });
    const seen = new Set(existingCards.map((card) => duplicateKey(card.front, card.back)));

    const toInsert: { front: string; back: string }[] = [];
    for (const item of dto.cards) {
      const key = duplicateKey(item.front, item.back);
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push({ front: item.front.trim(), back: item.back.trim() });
    }

    const startingPosition = await this.flashcardsRepository.count({ where: { set: { id: setId } } });

    const saved = await this.flashcardsRepository.manager.transaction(async (manager) => {
      if (toInsert.length === 0) return [];
      return manager.save(
        toInsert.map((item, index) =>
          manager.create(Flashcard, {
            set: { id: setId },
            front: item.front,
            back: item.back,
            position: startingPosition + index,
          }),
        ),
      );
    });

    if (saved.length > 0) {
      await this.flashcardSetsService.incrementCardCount(setId, saved.length);
    }

    return {
      cards: saved,
      totalReceived: dto.cards.length,
      importedCount: saved.length,
      duplicateCount: dto.cards.length - saved.length,
    };
  }

  private async findWithOwnerOrFail(cardId: string): Promise<Flashcard> {
    const card = await this.flashcardsRepository.findOne({
      where: { id: cardId },
      relations: { set: { creator: true } },
    });
    if (!card) {
      throw new NotFoundException('Flashcard not found');
    }
    return card;
  }

  // Same 404-before-403 ordering as FlashcardSetsService.assertOwnership —
  // a card in a private set someone else owns must 404, not 403, or the
  // 403 itself would confirm that set (and this card) exists.
  private assertCardOwnership(card: Flashcard, userId: string): void {
    if (card.set.visibility === SetVisibility.PRIVATE && card.set.creator.id !== userId) {
      throw new NotFoundException('Flashcard not found');
    }
    if (card.set.creator.id !== userId) {
      throw new ForbiddenException('You do not own the set this card belongs to');
    }
  }

  async update(cardId: string, userId: string, dto: UpdateFlashcardDto): Promise<Flashcard> {
    const card = await this.findWithOwnerOrFail(cardId);
    this.assertCardOwnership(card, userId);

    Object.assign(card, {
      ...(dto.front !== undefined ? { front: dto.front } : {}),
      ...(dto.back !== undefined ? { back: dto.back } : {}),
      ...(dto.frontImageUrl !== undefined ? { frontImageUrl: dto.frontImageUrl } : {}),
      ...(dto.backImageUrl !== undefined ? { backImageUrl: dto.backImageUrl } : {}),
    });
    return this.flashcardsRepository.save(card);
  }

  async remove(cardId: string, userId: string): Promise<void> {
    const card = await this.findWithOwnerOrFail(cardId);
    this.assertCardOwnership(card, userId);

    await this.flashcardsRepository.remove(card);
    await this.flashcardSetsService.incrementCardCount(card.set.id, -1);
  }

  /**
   * Inserts a copy of a card immediately after the original — not appended
   * at the end — so the duplicate is easy to find and diverge from its
   * source. Shifting later positions and inserting the copy both need to
   * land together, so it's wrapped in one transaction rather than left as
   * two independent writes a partial failure could leave inconsistent.
   */
  async duplicate(cardId: string, userId: string): Promise<Flashcard[]> {
    const card = await this.findWithOwnerOrFail(cardId);
    this.assertCardOwnership(card, userId);

    await this.flashcardsRepository.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(Flashcard)
        .set({ position: () => '"position" + 1' })
        .where('"set_id" = :setId AND "position" > :position', { setId: card.set.id, position: card.position })
        .execute();

      await manager.save(
        manager.create(Flashcard, {
          set: { id: card.set.id },
          front: card.front,
          back: card.back,
          frontImageUrl: card.frontImageUrl,
          backImageUrl: card.backImageUrl,
          position: card.position + 1,
        }),
      );
    });

    await this.flashcardSetsService.incrementCardCount(card.set.id, 1);
    return this.findBySet(card.set.id);
  }

  async reorder(setId: string, userId: string, dto: ReorderFlashcardsDto): Promise<Flashcard[]> {
    await this.flashcardSetsService.assertOwnership(setId, userId);

    const cards = await this.findBySet(setId);
    const existingIds = new Set(cards.map((card) => card.id));
    const requestedIds = new Set(dto.cardIds);

    if (existingIds.size !== requestedIds.size || [...existingIds].some((id) => !requestedIds.has(id))) {
      throw new BadRequestException('cardIds must include exactly the cards currently in this set');
    }

    await this.flashcardsRepository.manager.transaction(async (manager) => {
      await Promise.all(
        dto.cardIds.map((id, position) => manager.update(Flashcard, { id }, { position })),
      );
    });

    return this.findBySet(setId);
  }
}
