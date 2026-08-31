import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { FlashcardSet } from './entities/flashcard-set.entity.js';
import { FlashcardSetsService } from './flashcard-sets.service.js';
import { FlashcardSetsController } from './flashcard-sets.controller.js';

@Module({
  // PassportModule is needed here (not just in AuthModule) because
  // OptionalJwtAuthGuard extends @nestjs/passport's AuthGuard, which
  // resolves its options from whatever module's injector context declares
  // the controller it's applied to via @UseGuards().
  imports: [TypeOrmModule.forFeature([FlashcardSet]), PassportModule],
  controllers: [FlashcardSetsController],
  providers: [FlashcardSetsService],
  exports: [FlashcardSetsService],
})
export class FlashcardSetsModule {}
