import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OtpPurpose {
  REGISTRATION = 'REGISTRATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

/**
 * One row per issued code. A new code invalidates the previous active row
 * for the same (userId, purpose) rather than reusing it — see
 * OtpService.issueOtp — so "active" always means at most one row per
 * (userId, purpose) with consumedAt IS NULL AND expiresAt in the future.
 *
 * resetTokenHash/resetTokenExpiresAt are only ever populated for
 * PASSWORD_RESET rows, after the OTP itself has been verified — they carry
 * the short-lived, single-use authorization needed by POST /auth/reset-password
 * so that endpoint never has to trust a client-supplied email as identity.
 */
@Entity('otp_verifications')
@Index(['userId', 'purpose'])
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose: OtpPurpose;

  // bcrypt hash of the 6-digit code — never the raw code.
  @Column({ name: 'otp_hash', type: 'varchar' })
  otpHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  // Set once this row's job is fully done: for REGISTRATION that's the same
  // moment as verifiedAt; for PASSWORD_RESET it's set only once the reset
  // token has actually been redeemed via POST /auth/reset-password. Either
  // way, consumedAt IS NOT NULL means this row can never authorize anything
  // again.
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({ name: 'reset_token_hash', type: 'varchar', nullable: true })
  resetTokenHash: string | null;

  @Column({ name: 'reset_token_expires_at', type: 'timestamptz', nullable: true })
  resetTokenExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
