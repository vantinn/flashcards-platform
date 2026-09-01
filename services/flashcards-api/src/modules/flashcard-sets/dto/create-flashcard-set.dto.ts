import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SetLanguage, SetVisibility } from '../entities/flashcard-set.entity.js';

export class CreateFlashcardSetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(SetVisibility)
  visibility?: SetVisibility;

  // The official Set Category ("Danh mục") — English/Chinese/Free. Optional;
  // defaults to FREE at the entity level when omitted.
  @IsOptional()
  @IsEnum(SetLanguage)
  language?: SetLanguage;
}
