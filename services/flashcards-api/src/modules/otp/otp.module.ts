import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpVerification } from './entities/otp-verification.entity.js';
import { OtpService } from './otp.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OtpVerification])],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
