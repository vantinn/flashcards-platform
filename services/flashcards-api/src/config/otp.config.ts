import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  expirationMinutes: parseInt(process.env.OTP_EXPIRATION_MINUTES ?? '5', 10),
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
  resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '60', 10),
  maxRequestsPerHour: parseInt(process.env.OTP_MAX_REQUESTS_PER_HOUR ?? '5', 10),
}));
