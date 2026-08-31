import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudySession } from './entities/study-session.entity.js';
import { StudyService } from './study.service.js';
import { StudyController } from './study.controller.js';
import { FlashcardSetsModule } from '../flashcard-sets/flashcard-sets.module.js';
import { FlashcardsModule } from '../flashcards/flashcards.module.js';
import { ProgressModule } from '../progress/progress.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([StudySession]), FlashcardSetsModule, FlashcardsModule, ProgressModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
