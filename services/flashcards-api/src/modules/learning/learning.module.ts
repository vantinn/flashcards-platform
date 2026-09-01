import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningSession } from './entities/learning-session.entity.js';
import { LearningCardState } from './entities/learning-card-state.entity.js';
import { LearningService } from './learning.service.js';
import { LearningController } from './learning.controller.js';
import { FlashcardSetsModule } from '../flashcard-sets/flashcard-sets.module.js';
import { FlashcardsModule } from '../flashcards/flashcards.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([LearningSession, LearningCardState]), FlashcardSetsModule, FlashcardsModule],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
