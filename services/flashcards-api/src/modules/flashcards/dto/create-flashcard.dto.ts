import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateFlashcardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  front: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  back: string;

  @IsOptional()
  @IsUrl()
  frontImageUrl?: string;

  @IsOptional()
  @IsUrl()
  backImageUrl?: string;
}
