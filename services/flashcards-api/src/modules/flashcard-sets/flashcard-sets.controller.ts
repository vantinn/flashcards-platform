import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { FlashcardSetsService } from './flashcard-sets.service.js';
import { CreateFlashcardSetDto } from './dto/create-flashcard-set.dto.js';
import { UpdateFlashcardSetDto } from './dto/update-flashcard-set.dto.js';
import { MySetsQueryDto } from './dto/my-sets-query.dto.js';

@Controller('flashcard-sets')
export class FlashcardSetsController {
  constructor(private readonly flashcardSetsService: FlashcardSetsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: MySetsQueryDto) {
    return this.flashcardSetsService.findAllForUser(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFlashcardSetDto) {
    return this.flashcardSetsService.create(user.id, dto);
  }

  // No @Public() — a set (even a public one) is only visible to a signed-in
  // user; the global JwtAuthGuard rejects anonymous callers before this runs.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flashcardSetsService.findOneVisibleTo(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFlashcardSetDto,
  ) {
    return this.flashcardSetsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flashcardSetsService.remove(id, user.id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flashcardSetsService.duplicate(id, user.id);
  }
}
