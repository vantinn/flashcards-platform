import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CardAnswerDto } from './card-answer.dto.js';

export class CompleteStudySessionDto {
  // Aggregates (cardsStudied/correctCount/incorrectCount) are derived
  // server-side from this list rather than trusted from the client, so a
  // buggy or malicious client can't report totals that don't match what it
  // actually answered.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CardAnswerDto)
  results: CardAnswerDto[];
}
