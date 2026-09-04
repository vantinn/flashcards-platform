import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { rateLimit } from '../../common/guards/rate-limit.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

// Generous enough for real conversation, tight enough to block an obvious
// spam bot — modeled on AuthController's OTP_REQUEST_RATE_LIMIT shape.
const COMMENT_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

@Controller('flashcard-sets/:setId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findTopLevel(
    @Param('setId', ParseUUIDPipe) setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentsService.findTopLevelForSet(setId, user.id, query);
  }

  @Post()
  @UseGuards(rateLimit(COMMENT_RATE_LIMIT))
  create(
    @Param('setId', ParseUUIDPipe) setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(setId, user.id, dto);
  }

  @Get(':commentId/replies')
  findReplies(
    @Param('setId', ParseUUIDPipe) setId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.findRepliesForComment(setId, commentId, user.id);
  }

  @Post(':commentId/replies')
  @UseGuards(rateLimit(COMMENT_RATE_LIMIT))
  reply(
    @Param('setId', ParseUUIDPipe) setId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.reply(setId, commentId, user.id, dto);
  }
}
