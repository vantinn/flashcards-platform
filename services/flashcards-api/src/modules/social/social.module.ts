import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetLike } from './entities/set-like.entity.js';
import { Comment } from './entities/comment.entity.js';
import { LikesService } from './likes.service.js';
import { CommentsService } from './comments.service.js';
import { LikesController } from './likes.controller.js';
import { CommentsController } from './comments.controller.js';
import { CommentController } from './comment.controller.js';
import { SocialSummaryController } from './social-summary.controller.js';
import { FlashcardSetsModule } from '../flashcard-sets/flashcard-sets.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([SetLike, Comment]), FlashcardSetsModule],
  controllers: [LikesController, CommentsController, CommentController, SocialSummaryController],
  providers: [LikesService, CommentsService],
  exports: [LikesService, CommentsService],
})
export class SocialModule {}
