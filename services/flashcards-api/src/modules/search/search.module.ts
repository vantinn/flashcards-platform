import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashcardSet } from '../flashcard-sets/entities/flashcard-set.entity.js';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';
import { SocialModule } from '../social/social.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([FlashcardSet]), SocialModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
