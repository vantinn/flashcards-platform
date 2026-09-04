import { registerAs } from '@nestjs/config';
import { requiredInProduction } from './require-in-production.js';

/**
 * Resend credentials/sender are only required to *start* the app in
 * production — see requiredInProduction. In development they may be left
 * blank; email sending simply fails with a clear error when actually
 * attempted (see EmailService), so local work that doesn't touch the OTP
 * flow isn't blocked on having a real Resend API key.
 */
export default registerAs('mail', () => ({
  resendApiKey: requiredInProduction(process.env.RESEND_API_KEY, '', 'RESEND_API_KEY'),
  from: requiredInProduction(process.env.MAIL_FROM, '', 'MAIL_FROM'),
}));
