import { IsUUID } from 'class-validator';

export class StartStudySessionDto {
  @IsUUID('4')
  setId: string;
}
