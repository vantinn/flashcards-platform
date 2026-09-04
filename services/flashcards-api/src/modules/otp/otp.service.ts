import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { OtpPurpose, OtpVerification } from './entities/otp-verification.entity.js';
import {
  InvalidOtpException,
  InvalidResetTokenException,
  OtpAttemptsExceededException,
  OtpCooldownException,
  OtpRateLimitExceededException,
} from './otp.exceptions.js';

const OTP_SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 10;

export interface IssuedOtp {
  code: string;
  expiresAt: Date;
}

function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpVerification)
    private readonly otpRepository: Repository<OtpVerification>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  private get expirationMinutes(): number {
    return this.configService.get<number>('otp.expirationMinutes')!;
  }

  private get maxAttempts(): number {
    return this.configService.get<number>('otp.maxAttempts')!;
  }

  private get resendCooldownSeconds(): number {
    return this.configService.get<number>('otp.resendCooldownSeconds')!;
  }

  private get maxRequestsPerHour(): number {
    return this.configService.get<number>('otp.maxRequestsPerHour')!;
  }

  /**
   * Issues a fresh code, enforcing the resend cooldown and hourly cap
   * against every row created for this (userId, purpose) — not just active
   * ones — and invalidating whatever active row currently exists so at most
   * one code per (userId, purpose) can ever be verified at a time.
   */
  async issueOtp(userId: string, purpose: OtpPurpose): Promise<IssuedOtp> {
    const now = new Date();

    const mostRecent = await this.otpRepository.findOne({
      where: { userId, purpose },
      order: { createdAt: 'DESC' },
    });

    if (mostRecent) {
      const elapsedSeconds = (now.getTime() - mostRecent.createdAt.getTime()) / 1000;
      if (elapsedSeconds < this.resendCooldownSeconds) {
        throw new OtpCooldownException(Math.ceil(this.resendCooldownSeconds - elapsedSeconds));
      }
    }

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentCount = await this.otpRepository.count({
      where: { userId, purpose, createdAt: MoreThan(hourAgo) },
    });
    if (recentCount >= this.maxRequestsPerHour) {
      throw new OtpRateLimitExceededException();
    }

    await this.otpRepository.update({ userId, purpose, consumedAt: IsNull() }, { consumedAt: now });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const otpHash = await bcrypt.hash(code, OTP_SALT_ROUNDS);
    const expiresAt = new Date(now.getTime() + this.expirationMinutes * 60 * 1000);

    await this.otpRepository.save(
      this.otpRepository.create({ userId, purpose, otpHash, expiresAt }),
    );

    this.logger.log(`OTP issued: user=${userId} purpose=${purpose}`);
    return { code, expiresAt };
  }

  /**
   * Verifies a code against the single active row for (userId, purpose).
   * "Active" excludes both consumed and already-verified rows, so a code
   * can never be verified twice — for PASSWORD_RESET the row stays around
   * (consumedAt still null) after a successful verify only so
   * issueResetToken can bind a reset token to it; verifyOtp itself will
   * never match it again. Uses a row lock so two concurrent requests for
   * the same code can't both succeed.
   */
  async verifyOtp(userId: string, purpose: OtpPurpose, code: string): Promise<{ otpRowId: string }> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OtpVerification);
      const row = await repo
        .createQueryBuilder('otp')
        .setLock('pessimistic_write')
        .where('otp.user_id = :userId', { userId })
        .andWhere('otp.purpose = :purpose', { purpose })
        .andWhere('otp.consumed_at IS NULL')
        .andWhere('otp.verified_at IS NULL')
        .orderBy('otp.created_at', 'DESC')
        .getOne();

      if (!row) {
        throw new InvalidOtpException();
      }

      const now = new Date();
      if (row.expiresAt < now) {
        await repo.update(row.id, { consumedAt: now });
        throw new InvalidOtpException();
      }

      if (row.attempts >= this.maxAttempts) {
        await repo.update(row.id, { consumedAt: now });
        throw new OtpAttemptsExceededException();
      }

      const matches = await bcrypt.compare(code, row.otpHash);
      if (!matches) {
        const attempts = row.attempts + 1;
        const lockedOut = attempts >= this.maxAttempts;
        await repo.update(row.id, { attempts, ...(lockedOut ? { consumedAt: now } : {}) });
        throw lockedOut ? new OtpAttemptsExceededException() : new InvalidOtpException();
      }

      // REGISTRATION has no further step after this, so it's fully consumed
      // right away; PASSWORD_RESET stays "verified but not consumed" until
      // the minted reset token is actually redeemed in consumeResetToken.
      const consumedAt = purpose === OtpPurpose.REGISTRATION ? now : null;
      await repo.update(row.id, { verifiedAt: now, ...(consumedAt ? { consumedAt } : {}) });
      return { otpRowId: row.id };
    });
  }

  /** Called only after verifyOtp succeeds for a PASSWORD_RESET row — mints the short-lived authorization token for POST /auth/reset-password. */
  async issueResetToken(otpRowId: string): Promise<{ resetToken: string; expiresAt: Date }> {
    const row = await this.otpRepository.findOneBy({ id: otpRowId, purpose: OtpPurpose.PASSWORD_RESET });
    if (!row || !row.verifiedAt || row.consumedAt) {
      throw new InvalidResetTokenException();
    }

    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.otpRepository.update(row.id, {
      resetTokenHash: hashResetToken(resetToken),
      resetTokenExpiresAt: expiresAt,
    });

    return { resetToken, expiresAt };
  }

  /** Redeems a reset token exactly once, returning the user it authorizes a password change for. */
  async consumeResetToken(rawToken: string): Promise<{ userId: string }> {
    const tokenHash = hashResetToken(rawToken);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OtpVerification);
      const row = await repo
        .createQueryBuilder('otp')
        .setLock('pessimistic_write')
        .where('otp.reset_token_hash = :tokenHash', { tokenHash })
        .andWhere('otp.consumed_at IS NULL')
        .getOne();

      const now = new Date();
      if (!row || !row.resetTokenExpiresAt || row.resetTokenExpiresAt < now) {
        throw new InvalidResetTokenException();
      }

      await repo.update(row.id, { consumedAt: now });
      return { userId: row.userId };
    });
  }
}
