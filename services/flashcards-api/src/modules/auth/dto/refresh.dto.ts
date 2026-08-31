import { IsOptional, IsString } from 'class-validator';

/**
 * Web relies on the refresh_token cookie exclusively. Mobile has no cookie
 * jar in the same sense, so it sends the refresh token it stored itself —
 * this body is optional precisely so the existing web flow (no body at
 * all) keeps working unchanged.
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
