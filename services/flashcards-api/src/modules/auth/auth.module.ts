import { Module, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { EmailModule } from '../email/email.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';

// passport-google-oauth20's Strategy throws at *construction* if clientID
// is empty — it can't just fail lazily on first use — so with no Google
// credentials configured (the default for local dev, since none are
// committed to the repo) the provider is left out entirely rather than
// crashing the whole app on boot. GET /auth/google[/callback] still exist;
// they only fail if actually hit while unconfigured.
const googleOAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const googleProviders: Provider[] = googleOAuthConfigured ? [GoogleStrategy] : [];

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({}), OtpModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ...googleProviders],
  exports: [AuthService],
})
export class AuthModule {}
