import { PartialType } from '@nestjs/mapped-types';
import { CreateFlashcardSetDto } from './create-flashcard-set.dto.js';

export class UpdateFlashcardSetDto extends PartialType(CreateFlashcardSetDto) {}
