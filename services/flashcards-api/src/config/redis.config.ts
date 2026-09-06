import { registerAs } from '@nestjs/config';

/**
 * Redis is an optional performance layer here, not a hard dependency — see
 * CacheService. That's why there is no `requiredInProduction` call: the API
 * is designed to serve every request without it.
 *
 * What is deliberately *not* optional is being honest about it. The
 * localhost fallback exists so `npm run start:dev` works against the
 * docker-compose Redis with no .env at all, but applying that same fallback
 * in production would turn a missing/typo'd REDIS_URL into a silent
 * permanent cache outage: the app boots, connects to nothing, logs one
 * warning that scrolls away, and quietly serves every Explore request from
 * Postgres forever. In production a missing URL instead means "caching is
 * off", which CacheService says out loud at startup.
 */
export default registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? (process.env.NODE_ENV === 'production' ? null : 'redis://localhost:6379'),

  // Bounds how long a single command may hold an HTTP request hostage.
  // maxRetriesPerRequest only covers a connection ioredis *knows* is down;
  // a TCP-alive-but-unresponsive Redis (blocked on a slow command, swapping,
  // failing over) would otherwise hang the caller indefinitely. Every caller
  // has a Postgres fallback, so a fast failure is strictly better than a
  // slow success.
  commandTimeoutMs: parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS ?? '250', 10),
  connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '5000', 10),
}));
