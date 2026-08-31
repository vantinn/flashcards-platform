import { IsString, MinLength } from 'class-validator';

export class GoogleTokenDto {
  @IsString()
  @MinLength(10)
  idToken: string;
}
