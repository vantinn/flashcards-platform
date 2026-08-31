import { registerAs } from '@nestjs/config';
import { requiredInProduction } from './require-in-production.js';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Sets the CORS allow-origin. A silently-wrong default here wouldn't leak
  // anything by itself, but it would either lock out the real frontend or —
  // if ever left pointed at something an attacker controls — let another
  // origin make credentialed requests. Same "fail loudly" treatment as the
  // JWT secrets below.
  webUrl: requiredInProduction(process.env.WEB_URL, 'http://localhost:3000', 'WEB_URL'),
}));
