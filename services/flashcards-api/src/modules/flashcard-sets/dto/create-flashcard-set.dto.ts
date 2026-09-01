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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsEnum(SetLanguage)
  language?: SetLanguage;
}
