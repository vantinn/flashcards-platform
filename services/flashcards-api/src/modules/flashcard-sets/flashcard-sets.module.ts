import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashcardSet } from './entities/flashcard-set.entity.js';
import { FlashcardSetsService } from './flashcard-sets.service.js';
import { FlashcardSetsController } from './flashcard-sets.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FlashcardSet])],
  controllers: [FlashcardSetsController],
  providers: [FlashcardSetsService],
  exports: [FlashcardSetsService],
})
export class FlashcardSetsModule {}
