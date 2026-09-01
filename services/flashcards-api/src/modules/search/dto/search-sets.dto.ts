import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { SetLanguage } from '../../flashcard-sets/entities/flashcard-set.entity.js';

export class SearchSetsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  // Filters on the official Set Category (backed by FlashcardSet.language —
  // see that entity for why the two concepts share one column). Kept as the
  // `category` query param name since that's the product-facing concept;
  // an invalid value is rejected with 400 rather than silently ignored.
  @IsOptional()
  @IsEnum(SetLanguage)
  category?: SetLanguage;
}
