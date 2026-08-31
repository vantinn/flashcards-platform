import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { FlashcardsService } from './flashcards.service.js';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto.js';

// Deliberately flat (not nested under /flashcard-sets/:setId) — a card id
// alone is enough to identify and authorize a mutation once the card's
// parent set is loaded server-side, matching the guideline's
// `PATCH /flashcards/:id` / `DELETE /flashcards/:id` shape.
@Controller('flashcards')
export class FlashcardController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFlashcardDto,
  ) {
    return this.flashcardsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flashcardsService.remove(id, user.id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flashcardsService.duplicate(id, user.id);
  }
}
