import { registerAs } from '@nestjs/config';
import { requiredInProduction } from './require-in-production.js';

const DEV_ACCESS_SECRET = 'dev-access-secret-change-me';
const DEV_REFRESH_SECRET = 'dev-refresh-secret-change-me';

export default registerAs('auth', () => ({
  jwtAccessSecret: requiredInProduction(process.env.JWT_ACCESS_SECRET, DEV_ACCESS_SECRET, 'JWT_ACCESS_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshSecret: requiredInProduction(process.env.JWT_REFRESH_SECRET, DEV_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/api/v1/auth/google/callback',
}));
