import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Flashcard } from './entities/flashcard.entity.js';
import { FlashcardsService } from './flashcards.service.js';
import { FlashcardsController } from './flashcards.controller.js';
import { FlashcardController } from './flashcard.controller.js';
import { FlashcardSetsModule } from '../flashcard-sets/flashcard-sets.module.js';

@Module({
  // See FlashcardSetsModule for why PassportModule is imported directly
  // here too (OptionalJwtAuthGuard is used on FlashcardsController).
  imports: [TypeOrmModule.forFeature([Flashcard]), FlashcardSetsModule, PassportModule],
  controllers: [FlashcardsController, FlashcardController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
