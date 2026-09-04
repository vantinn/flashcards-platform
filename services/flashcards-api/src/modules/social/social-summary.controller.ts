import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import { LikesService } from './likes.service.js';
import { CommentsService } from './comments.service.js';

export interface SocialSummary {
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
}

// Kept separate from GET /flashcard-sets/:id (rather than folding this into
// that response) specifically to avoid a circular module dependency:
// SocialModule already depends on FlashcardSetsModule (for
// assertPublicForSocial), so FlashcardSetsModule can't depend back on
// SocialModule. A single-set detail page paying for one extra small request
// is a fine trade-off; Explore's list view (where an extra request per row
// would be a real N+1) gets its counts inlined directly in SearchService
// instead — see that module for the batched version of the same queries.
@Controller('flashcard-sets/:setId/social')
export class SocialSummaryController {
  constructor(
    private readonly flashcardSetsService: FlashcardSetsService,
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
  ) {}

  @Get()
  async getSummary(
    @Param('setId', ParseUUIDPipe) setId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SocialSummary> {
    await this.flashcardSetsService.assertPublicForSocial(setId, user.id);

    const [likeCounts, commentCounts, likedSetIds] = await Promise.all([
      this.likesService.countForSets([setId]),
      this.commentsService.countForSets([setId]),
      this.likesService.likedByUserForSets(user.id, [setId]),
    ]);

    return {
      likeCount: likeCounts.get(setId) ?? 0,
      commentCount: commentCounts.get(setId) ?? 0,
      likedByCurrentUser: likedSetIds.has(setId),
    };
  }
}
