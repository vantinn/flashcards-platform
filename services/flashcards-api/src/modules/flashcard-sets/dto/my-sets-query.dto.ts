import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { SetVisibility } from '../entities/flashcard-set.entity.js';

export class MySetsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(SetVisibility)
  visibility?: SetVisibility;
}
