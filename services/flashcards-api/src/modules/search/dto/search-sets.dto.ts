import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { SetLanguage } from '../../flashcard-sets/entities/flashcard-set.entity.js';

export class SearchSetsDto extends PaginationQueryDto {
  // Capped at the same 200 chars as FlashcardSet.title (see
  // CreateFlashcardSetDto): a term longer than the longest possible title
  // cannot match anything, so nothing legitimate is rejected. The cap is
  // what bounds Redis key cardinality — every distinct term becomes its own
  // cache key, and an uncapped free-text field is an open invitation to
  // spray junk into a memory-backed store.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  // Filters on the official Set Category (backed by FlashcardSet.language —
  // see that entity for why the two concepts share one column). Kept as the
  // `category` query param name since that's the product-facing concept;
  // an invalid value is rejected with 400 rather than silently ignored.
  @IsOptional()
  @IsEnum(SetLanguage)
  category?: SetLanguage;
}
