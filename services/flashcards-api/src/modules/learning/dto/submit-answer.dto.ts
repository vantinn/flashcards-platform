import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Deliberately does not carry correctness, progress, or completion — those
 * are always computed server-side in LearningService. Exactly one of
 * `selectedText` (multiple choice) / `typedText` (typed answer) must be
 * present, and it must match the question type actually being served
 * (`LearningSession.currentQuestionType`) — checked in the service, not
 * here, since the DTO alone can't know which question is current.
 */
export class SubmitAnswerDto {
  @IsUUID('4')
  flashcardId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selectedText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  typedText?: string;
}
