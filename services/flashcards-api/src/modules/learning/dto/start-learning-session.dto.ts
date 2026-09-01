import { IsEnum, IsUUID } from 'class-validator';
import { LearningMode } from '../entities/learning-session.entity.js';

export class StartLearningSessionDto {
  @IsUUID('4')
  setId: string;

  @IsEnum(LearningMode)
  mode: LearningMode;
}
