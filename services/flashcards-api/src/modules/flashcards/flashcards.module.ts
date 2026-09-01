import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flashcard } from './entities/flashcard.entity.js';
import { FlashcardsService } from './flashcards.service.js';
import { FlashcardsController } from './flashcards.controller.js';
import { FlashcardController } from './flashcard.controller.js';
import { FlashcardSetsModule } from '../flashcard-sets/flashcard-sets.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Flashcard]), FlashcardSetsModule],
  controllers: [FlashcardsController, FlashcardController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
