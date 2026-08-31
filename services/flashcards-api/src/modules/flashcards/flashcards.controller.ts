import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OptionalUser } from '../../common/decorators/optional-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import { FlashcardsService } from './flashcards.service.js';
import { CreateFlashcardDto } from './dto/create-flashcard.dto.js';
import { ReorderFlashcardsDto } from './dto/reorder-flashcards.dto.js';

@Controller('flashcard-sets/:setId/cards')
export class FlashcardsController {
  constructor(
    private readonly flashcardsService: FlashcardsService,
    private readonly flashcardSetsService: FlashcardSetsService,
  ) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findBySet(@Param('setId', ParseUUIDPipe) setId: string, @OptionalUser() user?: AuthenticatedUser) {
    // Reuses the set's own visibility rule so a private set's cards can't
    // be browsed by guessing its id even though this route is public.
    await this.flashcardSetsService.findOneVisibleTo(setId, user?.id);
    return this.flashcardsService.findBySet(setId);
  }

  @Post()
  create(
    @Param('setId', ParseUUIDPipe) setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFlashcardDto,
  ) {
    return this.flashcardsService.create(setId, user.id, dto);
  }

  @Patch('reorder')
  reorder(
    @Param('setId', ParseUUIDPipe) setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderFlashcardsDto,
  ) {
    return this.flashcardsService.reorder(setId, user.id, dto);
  }
}
