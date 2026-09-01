import { IsEmail, IsEnum } from 'class-validator';
import { OtpPurpose } from '../../otp/entities/otp-verification.entity.js';

export class ResendOtpDto {
  @IsEmail()
  email: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
