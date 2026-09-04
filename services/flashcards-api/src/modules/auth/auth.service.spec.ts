import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { OtpService } from '../otp/otp.service.js';
import { EmailService } from '../email/email.service.js';
import { OtpPurpose } from '../otp/entities/otp-verification.entity.js';
import { InvalidOtpException } from '../otp/otp.exceptions.js';
import type { User } from '../users/entities/user.entity.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: null,
    displayName: 'Test User',
    avatarUrl: null,
    googleId: null,
    emailVerifiedAt: new Date(),
    tokenVersion: 0,
    sets: [],
    studySessions: [],
    studyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    updatePendingRegistration: ReturnType<typeof vi.fn>;
    markEmailVerified: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
    incrementTokenVersion: ReturnType<typeof vi.fn>;
  };
  let otpService: {
    issueOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    issueResetToken: ReturnType<typeof vi.fn>;
    consumeResetToken: ReturnType<typeof vi.fn>;
  };
  let emailService: {
    sendRegistrationOtp: ReturnType<typeof vi.fn>;
    sendPasswordResetOtp: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      updatePendingRegistration: vi.fn(),
      markEmailVerified: vi.fn(),
      updatePassword: vi.fn(),
      incrementTokenVersion: vi.fn(),
    };
    otpService = {
      issueOtp: vi.fn().mockResolvedValue({ code: '123456', expiresAt: new Date(Date.now() + 5 * 60_000) }),
      verifyOtp: vi.fn(),
      issueResetToken: vi.fn(),
      consumeResetToken: vi.fn(),
    };
    emailService = {
      sendRegistrationOtp: vi.fn().mockResolvedValue(undefined),
      sendPasswordResetOtp: vi.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: OtpService, useValue: otpService },
        { provide: EmailService, useValue: emailService },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                'auth.jwtAccessSecret': 'test-access-secret',
                'auth.jwtAccessExpiresIn': '15m',
                'auth.jwtRefreshSecret': 'test-refresh-secret',
                'auth.jwtRefreshExpiresIn': '30d',
                'otp.expirationMinutes': 5,
                'otp.resendCooldownSeconds': 60,
              })[key],
          },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  describe('register', () => {
    it('creates an unverified account and sends a REGISTRATION OTP instead of issuing tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const created = buildUser({ emailVerifiedAt: null });
      usersService.create.mockResolvedValue(created);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      });

      expect(usersService.create).toHaveBeenCalledOnce();
      const createArg = usersService.create.mock.calls[0][0];
      expect(createArg.passwordHash).not.toBe('password123');
      expect(createArg.emailVerifiedAt).toBeNull();
      expect(otpService.issueOtp).toHaveBeenCalledWith(created.id, OtpPurpose.REGISTRATION);
      expect(emailService.sendRegistrationOtp).toHaveBeenCalledWith(created.email, '123456', 5);
      expect(result).toEqual({ email: created.email, expiresInMinutes: 5, resendAvailableInSeconds: 60 });
    });

    it('rejects an email that is already verified', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ emailVerifiedAt: new Date() }));

      await expect(
        authService.register({ email: 'test@example.com', password: 'password123', displayName: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-registering a still-unverified email updates it in place instead of creating a duplicate', async () => {
      const pending = buildUser({ emailVerifiedAt: null, displayName: 'Old Name' });
      usersService.findByEmail.mockResolvedValue(pending);
      usersService.updatePendingRegistration.mockResolvedValue({ ...pending, displayName: 'New Name' });

      await authService.register({ email: 'test@example.com', password: 'password123', displayName: 'New Name' });

      expect(usersService.create).not.toHaveBeenCalled();
      expect(usersService.updatePendingRegistration).toHaveBeenCalledWith(
        pending.id,
        expect.objectContaining({ displayName: 'New Name' }),
      );
      expect(otpService.issueOtp).toHaveBeenCalledWith(pending.id, OtpPurpose.REGISTRATION);
    });
  });

  describe('verifyRegistration', () => {
    it('marks the account verified and issues tokens on a correct code', async () => {
      const user = buildUser({ emailVerifiedAt: null });
      usersService.findByEmail.mockResolvedValue(user);
      otpService.verifyOtp.mockResolvedValue({ otpRowId: 'otp-1' });

      const result = await authService.verifyRegistration({ email: user.email, otp: '123456' });

      expect(otpService.verifyOtp).toHaveBeenCalledWith(user.id, OtpPurpose.REGISTRATION, '123456');
      expect(usersService.markEmailVerified).toHaveBeenCalledWith(user.id);
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it('rejects an unknown email with the same error as a wrong code', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.verifyRegistration({ email: 'nobody@example.com', otp: '123456' })).rejects.toBeInstanceOf(
        InvalidOtpException,
      );
    });

    it('propagates OtpService rejection for an expired or wrong code', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ emailVerifiedAt: null }));
      otpService.verifyOtp.mockRejectedValue(new InvalidOtpException());

      await expect(authService.verifyRegistration({ email: 'test@example.com', otp: '000000' })).rejects.toBeInstanceOf(
        InvalidOtpException,
      );
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('resendOtp', () => {
    it('reissues a REGISTRATION code for a pending account', async () => {
      const user = buildUser({ emailVerifiedAt: null });
      usersService.findByEmail.mockResolvedValue(user);

      const result = await authService.resendOtp({ email: user.email, purpose: OtpPurpose.REGISTRATION });

      expect(otpService.issueOtp).toHaveBeenCalledWith(user.id, OtpPurpose.REGISTRATION);
      expect(result.message).toBeTruthy();
    });

    it('rejects a REGISTRATION resend for an already-verified account', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ emailVerifiedAt: new Date() }));

      await expect(
        authService.resendOtp({ email: 'test@example.com', purpose: OtpPurpose.REGISTRATION }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('delegates a PASSWORD_RESET resend to the same generic-response path as forgotPassword', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.resendOtp({ email: 'nobody@example.com', purpose: OtpPurpose.PASSWORD_RESET });

      expect(result.message).toBe('If an account with this email exists, a verification code has been sent.');
      expect(otpService.issueOtp).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword — user enumeration protection', () => {
    it('returns the same generic message for an existing password account', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash: 'hash' }));

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(otpService.issueOtp).toHaveBeenCalledOnce();
      expect(result.message).toBe('If an account with this email exists, a verification code has been sent.');
    });

    it('returns the identical message for a non-existent email, without issuing an OTP', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: 'nobody@example.com' });

      expect(otpService.issueOtp).not.toHaveBeenCalled();
      expect(result.message).toBe('If an account with this email exists, a verification code has been sent.');
    });

    it('returns the identical message for a Google-only account with no password', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash: null, googleId: 'g-1' }));

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(otpService.issueOtp).not.toHaveBeenCalled();
      expect(result.message).toBe('If an account with this email exists, a verification code has been sent.');
    });

    it('still returns the generic message when OTP issuance is rate-limited internally', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash: 'hash' }));
      otpService.issueOtp.mockRejectedValue(new Error('cooldown active'));

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(result.message).toBe('If an account with this email exists, a verification code has been sent.');
    });
  });

  describe('verifyResetOtp / resetPassword', () => {
    it('issues a reset token after a correct code', async () => {
      const user = buildUser();
      usersService.findByEmail.mockResolvedValue(user);
      otpService.verifyOtp.mockResolvedValue({ otpRowId: 'otp-1' });
      otpService.issueResetToken.mockResolvedValue({ resetToken: 'raw-token', expiresAt: new Date(Date.now() + 10 * 60_000) });

      const result = await authService.verifyResetOtp({ email: user.email, otp: '123456' });

      expect(otpService.verifyOtp).toHaveBeenCalledWith(user.id, OtpPurpose.PASSWORD_RESET, '123456');
      expect(result.resetToken).toBe('raw-token');
    });

    it('rejects when passwords do not match, without touching the reset token', async () => {
      await expect(
        authService.resetPassword({ resetToken: 'raw-token', newPassword: 'password123', confirmPassword: 'different' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(otpService.consumeResetToken).not.toHaveBeenCalled();
    });

    it('updates the password and bumps tokenVersion on a valid reset token', async () => {
      otpService.consumeResetToken.mockResolvedValue({ userId: 'user-1' });

      const result = await authService.resetPassword({
        resetToken: 'raw-token',
        newPassword: 'password123',
        confirmPassword: 'password123',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
      expect(usersService.incrementTokenVersion).toHaveBeenCalledWith('user-1');
      expect(result.message).toBeTruthy();
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a Google-only account with no password set', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash: null }));

      await expect(
        authService.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects the wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash: await import('bcrypt').then((b) => b.hash('correct-password', 12)) }),
      );

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects the correct password for an unverified account', async () => {
      const bcrypt = await import('bcrypt');
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash: await bcrypt.hash('correct-password', 12), emailVerifiedAt: null }),
      );

      await expect(
        authService.login({ email: 'test@example.com', password: 'correct-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts the correct password for a verified account and issues tokens', async () => {
      const bcrypt = await import('bcrypt');
      const user = buildUser({ passwordHash: await bcrypt.hash('correct-password', 12), emailVerifiedAt: new Date() });
      usersService.findByEmail.mockResolvedValue(user);

      const result = await authService.login({ email: 'test@example.com', password: 'correct-password' });

      expect(result.user).toBe(user);
      expect(result.tokens.accessToken).toBeTruthy();
    });
  });

  describe('refresh', () => {
    it('rejects a token signed with the wrong secret', async () => {
      const forgedToken = jwtService.sign({ sub: 'user-1', email: 'test@example.com', tokenVersion: 0 }, { secret: 'not-the-real-secret' });
      await expect(authService.refresh(forgedToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a garbage string that is not a JWT at all', async () => {
      await expect(authService.refresh('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a validly-signed token for a user that no longer exists', async () => {
      const token = jwtService.sign({ sub: 'deleted-user', email: 'gone@example.com', tokenVersion: 0 }, { secret: 'test-refresh-secret' });
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token whose tokenVersion is stale (password was reset since issuance)', async () => {
      const token = jwtService.sign({ sub: 'user-1', email: 'test@example.com', tokenVersion: 0 }, { secret: 'test-refresh-secret' });
      usersService.findById.mockResolvedValue(buildUser({ tokenVersion: 1 }));

      await expect(authService.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a fresh token pair for a validly-signed token whose user still exists', async () => {
      const token = jwtService.sign({ sub: 'user-1', email: 'test@example.com', tokenVersion: 0 }, { secret: 'test-refresh-secret' });
      const user = buildUser({ tokenVersion: 0 });
      usersService.findById.mockResolvedValue(user);

      const result = await authService.refresh(token);

      expect(result.user).toBe(user);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });
  });
});
