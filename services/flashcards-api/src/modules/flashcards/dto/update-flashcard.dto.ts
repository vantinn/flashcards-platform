import { PartialType } from '@nestjs/mapped-types';
import { CreateFlashcardDto } from './create-flashcard.dto.js';

export class UpdateFlashcardDto extends PartialType(CreateFlashcardDto) {}
