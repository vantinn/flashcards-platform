import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import type { User } from '../users/entities/user.entity.js';
import { OtpService } from '../otp/otp.service.js';
import { OtpPurpose } from '../otp/entities/otp-verification.entity.js';
import { InvalidOtpException } from '../otp/otp.exceptions.js';
import { EmailService } from '../email/email.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { ResendOtpDto } from './dto/resend-otp.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { JwtPayload } from './auth.types.js';
import type { GoogleProfile } from './strategies/google.strategy.js';

const PASSWORD_SALT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PendingRegistration {
  email: string;
  expiresInMinutes: number;
  resendAvailableInSeconds: number;
}

const GENERIC_FORGOT_PASSWORD_MESSAGE = 'If an account with this email exists, a verification code has been sent.';
const GENERIC_RESEND_MESSAGE = 'If a matching request exists, a new verification code has been sent.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {
    this.googleClient = new OAuth2Client(this.configService.get<string>('auth.googleClientId'));
  }

  private get otpExpirationMinutes(): number {
    return this.configService.get<number>('otp.expirationMinutes')!;
  }

  private get otpResendCooldownSeconds(): number {
    return this.configService.get<number>('otp.resendCooldownSeconds')!;
  }

  /**
   * Creates (or reuses, if still unverified) the account and sends a
   * REGISTRATION OTP. No tokens are issued here — login/verifyRegistration
   * is the only path to a session, since the email hasn't been confirmed
   * yet. Re-registering the same still-unverified email updates that row
   * in place rather than creating a duplicate (the unique email constraint
   * would reject a second insert anyway) — this is what makes retries safe.
   */
  async register(dto: RegisterDto): Promise<PendingRegistration> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing?.emailVerifiedAt) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = existing
      ? await this.usersService.updatePendingRegistration(existing.id, { displayName: dto.displayName, passwordHash })
      : await this.usersService.create({ email: dto.email, displayName: dto.displayName, passwordHash, emailVerifiedAt: null });

    return this.issueAndSendRegistrationOtp(user);
  }

  private async issueAndSendRegistrationOtp(user: User): Promise<PendingRegistration> {
    const { code } = await this.otpService.issueOtp(user.id, OtpPurpose.REGISTRATION);
    await this.emailService.sendRegistrationOtp(user.email, code, this.otpExpirationMinutes);

    return {
      email: user.email,
      expiresInMinutes: this.otpExpirationMinutes,
      resendAvailableInSeconds: this.otpResendCooldownSeconds,
    };
  }

  async verifyRegistration(dto: VerifyOtpDto): Promise<{ user: User; tokens: TokenPair }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Same error an existing-but-wrong-code user would see — this
      // endpoint never confirms or denies that an email has a pending
      // registration.
      throw new InvalidOtpException();
    }

    await this.otpService.verifyOtp(user.id, OtpPurpose.REGISTRATION, dto.otp);
    await this.usersService.markEmailVerified(user.id);

    const verifiedUser = { ...user, emailVerifiedAt: new Date() };
    return { user: verifiedUser, tokens: this.issueTokens(verifiedUser) };
  }

  /**
   * Resend for PASSWORD_RESET delegates straight to forgotPassword() — same
   * enumeration-safe contract, since "resend" and "request a reset code"
   * are the same operation from the account-existence-hiding point of view.
   * Resend for REGISTRATION is allowed to be specific: the caller already
   * knows this email exists (they just tried to register it themselves).
   */
  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    if (dto.purpose === OtpPurpose.PASSWORD_RESET) {
      return this.forgotPassword({ email: dto.email });
    }

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.emailVerifiedAt) {
      throw new BadRequestException('No pending registration found for this email.');
    }

    await this.issueAndSendRegistrationOtp(user);
    return { message: GENERIC_RESEND_MESSAGE };
  }

  /**
   * Always returns the same generic message regardless of whether the
   * account exists, has a password at all, or whether sending/rate-limiting
   * failed internally — see the class-level enumeration-safety requirement.
   * Real failures are logged server-side for operability, never surfaced.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findByEmail(dto.email);
      if (user?.passwordHash) {
        const { code } = await this.otpService.issueOtp(user.id, OtpPurpose.PASSWORD_RESET);
        await this.emailService.sendPasswordResetOtp(user.email, code, this.otpExpirationMinutes);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`forgotPassword: internal error suppressed for enumeration safety (${reason})`);
    }

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  async verifyResetOtp(dto: VerifyOtpDto): Promise<{ resetToken: string; expiresInMinutes: number }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new InvalidOtpException();
    }

    const { otpRowId } = await this.otpService.verifyOtp(user.id, OtpPurpose.PASSWORD_RESET, dto.otp);
    const { resetToken, expiresAt } = await this.otpService.issueResetToken(otpRowId);

    return { resetToken, expiresInMinutes: Math.round((expiresAt.getTime() - Date.now()) / 60_000) };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const { userId } = await this.otpService.consumeResetToken(dto.resetToken);
    const passwordHash = await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS);

    await this.usersService.updatePassword(userId, passwordHash);
    // Kills every refresh token issued before this point — see the
    // tokenVersion note on JwtPayload / AuthService.refresh().
    await this.usersService.incrementTokenVersion(userId);

    return { message: 'Password has been reset. Please log in with your new password.' };
  }

  async login(dto: LoginDto): Promise<{ user: User; tokens: TokenPair }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      // Never log dto.password — email + the fact that it failed is all
      // that's useful for spotting credential-stuffing/enumeration, and
      // the response is identical either way (see UsersService.toPublic)
      // so this log line doesn't create a side channel the client can see.
      this.logger.warn(`Login failed (no account or no password set): ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      this.logger.warn(`Login failed (wrong password): ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Checked after the password match (not before) so a guesser without
    // the right password can't use this response to learn whether an
    // account is verified.
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email before logging in.');
    }

    return { user, tokens: this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<{ user: User; tokens: TokenPair }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      });
    } catch {
      // Never log the token itself — it's a live credential, not just an
      // identifier, for as long as it would otherwise have been valid.
      this.logger.warn('Refresh rejected: invalid or expired token');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      this.logger.warn(`Refresh rejected: token valid but user ${payload.sub} no longer exists`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.tokenVersion !== user.tokenVersion) {
      this.logger.warn(`Refresh rejected: token version stale for user ${payload.sub} (password reset since issuance)`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return { user, tokens: this.issueTokens(user) };
  }

  async loginWithGoogle(profile: GoogleProfile): Promise<{ user: User; tokens: TokenPair }> {
    const user = await this.usersService.findOrCreateByGoogleProfile(profile);
    return { user, tokens: this.issueTokens(user) };
  }

  /**
   * Native mobile sign-in (Android/iOS) gets a Google ID token client-side
   * and sends it here directly — unlike the web flow (GET /auth/google),
   * there's no redirect/consent-screen round trip for a native app to hook
   * into. Verifies the token's signature and audience server-side before
   * trusting any of its claims.
   */
  async loginWithGoogleIdToken(idToken: string): Promise<{ user: User; tokens: TokenPair }> {
    const audience = this.configService.get<string>('auth.googleClientId');
    if (!audience) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let payload: { sub: string; email?: string; name?: string; picture?: string } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      // Never log the idToken itself, same reasoning as the refresh token above.
      this.logger.warn('Google sign-in rejected: token failed verification');
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const user = await this.usersService.findOrCreateByGoogleProfile({
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name ?? payload.email,
      avatarUrl: payload.picture ?? null,
    });
    return { user, tokens: this.issueTokens(user) };
  }

  private issueTokens(user: User): TokenPair {
    const payload: JwtPayload = { sub: user.id, email: user.email, tokenVersion: user.tokenVersion };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwtAccessSecret'),
      expiresIn: this.configService.get<string>('auth.jwtAccessExpiresIn') as never,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('auth.jwtRefreshExpiresIn') as never,
    });

    return { accessToken, refreshToken };
  }
}
