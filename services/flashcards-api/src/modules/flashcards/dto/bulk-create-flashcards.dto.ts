import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

// Same per-field rules as CreateFlashcardDto's front/back — bulk-created
// cards must follow identical business rules to manually-created ones.
export class BulkFlashcardItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  front: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  back: string;
}

// A fixed, generous hard ceiling enforced right here at the DTO layer,
// before the request even reaches the service — a class-validator decorator
// can't read the runtime-configurable MAX_BULK_FLASHCARDS (see
// flashcards.config.ts), so the real, configurable limit is enforced by
// FlashcardsService.bulkCreate() instead. This ceiling only exists so an
// absurd payload (tens of thousands of rows) is rejected immediately rather
// than reaching business logic at all.
const HARD_MAX_ITEMS = 1000;

export class BulkCreateFlashcardsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HARD_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => BulkFlashcardItemDto)
  cards: BulkFlashcardItemDto[];
}
