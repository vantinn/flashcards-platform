import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

interface RateLimitOptions {
  /** Requests allowed per window, per client IP, per route this guard is applied to. */
  limit: number;
  windowMs: number;
}

/**
 * A minimal in-memory sliding-window limiter for the auth endpoints
 * (register/login/refresh have no other brute-force protection). No
 * external package here because no `@nestjs/throttler` release yet
 * supports Nest 12 in this environment — see package.json.
 *
 * Deliberately simple: single-process in-memory state. That's fine for one
 * API instance; a multi-instance deployment would need a shared store
 * (Redis) instead, since each process would otherwise track its own count.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly hits = new Map<string, number[]>();

  constructor(private readonly options: RateLimitOptions) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${request.route?.path ?? request.path}:${request.ip}`;
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    const existing = RateLimitGuard.hits.get(key) ?? [];
    const recent = existing.filter((timestamp) => timestamp > windowStart);

    if (recent.length >= this.options.limit) {
      throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    recent.push(now);
    RateLimitGuard.hits.set(key, recent);
    return true;
  }
}

/** Factory so each route can declare its own limit via @UseGuards(rateLimit({ limit, windowMs })). */
export function rateLimit(options: RateLimitOptions) {
  return new RateLimitGuard(options);
}
