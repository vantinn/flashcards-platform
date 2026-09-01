import { HttpException, HttpStatus } from '@nestjs/common';

/** Wrong code, expired code, or no active code at all — deliberately one message for all three so a guesser can't distinguish "expired" from "wrong". */
export class InvalidOtpException extends HttpException {
  constructor() {
    super('Invalid or expired verification code.', HttpStatus.BAD_REQUEST);
  }
}

export class OtpAttemptsExceededException extends HttpException {
  constructor() {
    super('Too many incorrect attempts. Please request a new code.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class OtpCooldownException extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Please wait ${retryAfterSeconds}s before requesting another code.`, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class OtpRateLimitExceededException extends HttpException {
  constructor() {
    super('Too many verification codes requested. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Missing, expired, or already-redeemed reset token — one message for all three, same rationale as InvalidOtpException. */
export class InvalidResetTokenException extends HttpException {
  constructor() {
    super('Invalid or expired password reset request. Please start over.', HttpStatus.BAD_REQUEST);
  }
}
