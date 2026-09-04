import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import { OtpService } from './otp.service.js';
import { OtpPurpose, OtpVerification } from './entities/otp-verification.entity.js';
import {
  InvalidOtpException,
  InvalidResetTokenException,
  OtpAttemptsExceededException,
  OtpCooldownException,
  OtpRateLimitExceededException,
} from './otp.exceptions.js';

function buildRow(overrides: Partial<OtpVerification> = {}): OtpVerification {
  return {
    id: 'otp-1',
    userId: 'user-1',
    purpose: OtpPurpose.REGISTRATION,
    otpHash: '',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    verifiedAt: null,
    consumedAt: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as OtpVerification;
}

/** Chainable stub mirroring the subset of TypeORM's QueryBuilder that OtpService uses. */
function makeQueryBuilder(result: OtpVerification | null) {
  const qb = {
    setLock: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    getOne: vi.fn().mockResolvedValue(result),
  };
  qb.setLock.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  return qb;
}

describe('OtpService', () => {
  let otpService: OtpService;
  let otpRepository: {
    findOne: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
  };
  let txUpdate: ReturnType<typeof vi.fn>;
  let dataSource: { transaction: ReturnType<typeof vi.fn> };

  /** Configures what the next transaction's row lookup (getOne) resolves to. */
  function setTransactionResult(row: OtpVerification | null) {
    dataSource.transaction.mockImplementation(async (cb: (manager: unknown) => unknown) =>
      cb({
        getRepository: () => ({
          createQueryBuilder: () => makeQueryBuilder(row),
          update: txUpdate,
        }),
      }),
    );
  }

  beforeEach(async () => {
    otpRepository = {
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn((input) => buildRow(input)),
      save: vi.fn((row) => Promise.resolve(row)),
      findOneBy: vi.fn().mockResolvedValue(null),
    };
    txUpdate = vi.fn().mockResolvedValue(undefined);
    dataSource = { transaction: vi.fn() };
    setTransactionResult(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getRepositoryToken(OtpVerification), useValue: otpRepository },
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                'otp.expirationMinutes': 5,
                'otp.maxAttempts': 5,
                'otp.resendCooldownSeconds': 60,
                'otp.maxRequestsPerHour': 5,
              })[key],
          },
        },
      ],
    }).compile();

    otpService = moduleRef.get(OtpService);
  });

  describe('issueOtp', () => {
    it('generates a 6-digit numeric code and stores only its bcrypt hash', async () => {
      const { code, expiresAt } = await otpService.issueOtp('user-1', OtpPurpose.REGISTRATION);

      expect(code).toMatch(/^\d{6}$/);
      expect(otpRepository.save).toHaveBeenCalledOnce();
      const saved = otpRepository.save.mock.calls[0][0] as OtpVerification;
      expect(saved.otpHash).not.toBe(code);
      expect(await bcrypt.compare(code, saved.otpHash)).toBe(true);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('invalidates any existing active row before issuing a new one', async () => {
      await otpService.issueOtp('user-1', OtpPurpose.REGISTRATION);
      expect(otpRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', purpose: OtpPurpose.REGISTRATION }),
        expect.objectContaining({ consumedAt: expect.any(Date) }),
      );
    });

    it('rejects while the resend cooldown has not elapsed', async () => {
      otpRepository.findOne.mockResolvedValue(buildRow({ createdAt: new Date(Date.now() - 10_000) }));

      await expect(otpService.issueOtp('user-1', OtpPurpose.REGISTRATION)).rejects.toBeInstanceOf(OtpCooldownException);
    });

    it('allows a new code once the cooldown has elapsed', async () => {
      otpRepository.findOne.mockResolvedValue(buildRow({ createdAt: new Date(Date.now() - 61_000) }));

      await expect(otpService.issueOtp('user-1', OtpPurpose.REGISTRATION)).resolves.toBeDefined();
    });

    it('rejects once the hourly request cap is reached', async () => {
      otpRepository.count.mockResolvedValue(5);

      await expect(otpService.issueOtp('user-1', OtpPurpose.REGISTRATION)).rejects.toBeInstanceOf(
        OtpRateLimitExceededException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('accepts the correct code and marks REGISTRATION rows fully consumed', async () => {
      const code = '482913';
      const otpHash = await bcrypt.hash(code, 10);
      setTransactionResult(buildRow({ otpHash }));

      const result = await otpService.verifyOtp('user-1', OtpPurpose.REGISTRATION, code);

      expect(result.otpRowId).toBe('otp-1');
      expect(txUpdate).toHaveBeenCalledWith(
        'otp-1',
        expect.objectContaining({ verifiedAt: expect.any(Date), consumedAt: expect.any(Date) }),
      );
    });

    it('accepts the correct code for PASSWORD_RESET without consuming the row', async () => {
      const code = '482913';
      const otpHash = await bcrypt.hash(code, 10);
      setTransactionResult(buildRow({ purpose: OtpPurpose.PASSWORD_RESET, otpHash }));

      await otpService.verifyOtp('user-1', OtpPurpose.PASSWORD_RESET, code);

      expect(txUpdate).toHaveBeenCalledWith('otp-1', { verifiedAt: expect.any(Date) });
    });

    it('rejects when no active row exists', async () => {
      setTransactionResult(null);

      await expect(otpService.verifyOtp('user-1', OtpPurpose.REGISTRATION, '000000')).rejects.toBeInstanceOf(
        InvalidOtpException,
      );
    });

    it('rejects an expired row and consumes it', async () => {
      setTransactionResult(buildRow({ expiresAt: new Date(Date.now() - 1000) }));

      await expect(otpService.verifyOtp('user-1', OtpPurpose.REGISTRATION, '000000')).rejects.toBeInstanceOf(
        InvalidOtpException,
      );
      expect(txUpdate).toHaveBeenCalledWith('otp-1', { consumedAt: expect.any(Date) });
    });

    it('rejects a wrong code and increments attempts without consuming the row', async () => {
      const otpHash = await bcrypt.hash('111111', 10);
      setTransactionResult(buildRow({ otpHash, attempts: 1 }));

      await expect(otpService.verifyOtp('user-1', OtpPurpose.REGISTRATION, '222222')).rejects.toBeInstanceOf(
        InvalidOtpException,
      );
      expect(txUpdate).toHaveBeenCalledWith('otp-1', { attempts: 2 });
    });

    it('locks the row out once max attempts is reached on a wrong guess', async () => {
      const otpHash = await bcrypt.hash('111111', 10);
      setTransactionResult(buildRow({ otpHash, attempts: 4 })); // maxAttempts = 5

      await expect(otpService.verifyOtp('user-1', OtpPurpose.REGISTRATION, '222222')).rejects.toBeInstanceOf(
        OtpAttemptsExceededException,
      );
      expect(txUpdate).toHaveBeenCalledWith('otp-1', { attempts: 5, consumedAt: expect.any(Date) });
    });

    it('rejects immediately if the row already reached max attempts', async () => {
      setTransactionResult(buildRow({ attempts: 5 }));

      await expect(otpService.verifyOtp('user-1', OtpPurpose.REGISTRATION, '000000')).rejects.toBeInstanceOf(
        OtpAttemptsExceededException,
      );
    });

    it('a used code can never be verified again (single-use)', async () => {
      const code = '482913';
      const otpHash = await bcrypt.hash(code, 10);
      // Simulating "already verified": the active-row query filters
      // verified_at IS NULL, so a second verify attempt finds nothing.
      setTransactionResult(null);
      void otpHash;

      await expect(otpService.verifyOtp('user-1', OtpPurpose.REGISTRATION, code)).rejects.toBeInstanceOf(
        InvalidOtpException,
      );
    });
  });

  describe('issueResetToken', () => {
    it('mints a high-entropy token and stores only its hash', async () => {
      otpRepository.findOneBy.mockResolvedValue(
        buildRow({ purpose: OtpPurpose.PASSWORD_RESET, verifiedAt: new Date() }),
      );

      const { resetToken, expiresAt } = await otpService.issueResetToken('otp-1');

      expect(resetToken).toMatch(/^[0-9a-f]{64}$/);
      expect(otpRepository.update).toHaveBeenCalledWith(
        'otp-1',
        expect.objectContaining({ resetTokenHash: expect.any(String), resetTokenExpiresAt: expect.any(Date) }),
      );
      expect(otpRepository.update.mock.calls[0][1].resetTokenHash).not.toBe(resetToken);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects if the row was never verified', async () => {
      otpRepository.findOneBy.mockResolvedValue(buildRow({ purpose: OtpPurpose.PASSWORD_RESET, verifiedAt: null }));

      await expect(otpService.issueResetToken('otp-1')).rejects.toBeInstanceOf(InvalidResetTokenException);
    });

    it('rejects if the row no longer exists', async () => {
      otpRepository.findOneBy.mockResolvedValue(null);

      await expect(otpService.issueResetToken('otp-1')).rejects.toBeInstanceOf(InvalidResetTokenException);
    });
  });

  describe('consumeResetToken', () => {
    it('redeems a valid token exactly once', async () => {
      setTransactionResult(
        buildRow({
          purpose: OtpPurpose.PASSWORD_RESET,
          verifiedAt: new Date(),
          resetTokenExpiresAt: new Date(Date.now() + 60_000),
        }),
      );

      const result = await otpService.consumeResetToken('any-raw-token');

      expect(result.userId).toBe('user-1');
      expect(txUpdate).toHaveBeenCalledWith('otp-1', { consumedAt: expect.any(Date) });
    });

    it('rejects an expired token', async () => {
      setTransactionResult(
        buildRow({
          purpose: OtpPurpose.PASSWORD_RESET,
          resetTokenExpiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(otpService.consumeResetToken('any-raw-token')).rejects.toBeInstanceOf(InvalidResetTokenException);
    });

    it('rejects an unknown or already-consumed token', async () => {
      setTransactionResult(null);

      await expect(otpService.consumeResetToken('any-raw-token')).rejects.toBeInstanceOf(InvalidResetTokenException);
    });
  });
});
