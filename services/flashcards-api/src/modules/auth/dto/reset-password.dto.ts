import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt silently truncates beyond 72 bytes — reject longer input instead of accepting it and quietly ignoring the tail
  newPassword: string;

  @IsString()
  confirmPassword: string;
}
