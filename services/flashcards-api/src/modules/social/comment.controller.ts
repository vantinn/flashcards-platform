import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';

// Deliberately flat (not nested under /flashcard-sets/:setId), matching
// FlashcardController's PATCH/DELETE /flashcards/:id shape — a comment id
// alone is enough to identify and authorize a mutation once its parent
// set/author are loaded server-side.
@Controller('comments')
export class CommentController {
  constructor(private readonly commentsService: CommentsService) {}

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.remove(id, user.id);
  }
}
