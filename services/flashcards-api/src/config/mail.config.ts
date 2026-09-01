import { registerAs } from '@nestjs/config';
import { requiredInProduction } from './require-in-production.js';

/**
 * Gmail credentials are only required to *start* the app in production —
 * see requiredInProduction. In development they may be left blank; email
 * sending simply fails with a clear error when actually attempted (see
 * EmailService), so local work that doesn't touch the OTP flow isn't
 * blocked on having real Gmail creds.
 */
export default registerAs('mail', () => ({
  gmailUser: requiredInProduction(process.env.GMAIL_USER, '', 'GMAIL_USER'),
  gmailAppPassword: requiredInProduction(process.env.GMAIL_APP_PASSWORD, '', 'GMAIL_APP_PASSWORD'),
  fromName: process.env.MAIL_FROM_NAME ?? 'Flashcards',
}));
