import { Controller, Delete, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { LikesService } from './likes.service.js';

@Controller('flashcard-sets/:setId/likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  like(@Param('setId', ParseUUIDPipe) setId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.likesService.like(setId, user.id);
  }

  @Delete()
  unlike(@Param('setId', ParseUUIDPipe) setId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.likesService.unlike(setId, user.id);
  }
}
