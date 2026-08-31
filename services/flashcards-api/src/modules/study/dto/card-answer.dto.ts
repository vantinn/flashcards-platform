import { IsEnum, IsUUID } from 'class-validator';
import { CardRating } from '../../progress/card-rating.enum.js';

export class CardAnswerDto {
  @IsUUID('4')
  flashcardId: string;

  @IsEnum(CardRating)
  rating: CardRating;
}
