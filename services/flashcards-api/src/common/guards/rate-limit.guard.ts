import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

interface RateLimitOptions {
  /** Requests allowed per window, per client IP, per route this guard is applied to. */
  limit: number;
  windowMs: number;
}

/**
 * Hard ceiling on tracked buckets. Reached only under a distributed attack
 * (each distinct source IP is one bucket); a normal user population never
 * comes close. Well below the point where the Map itself becomes a memory
 * problem, and small enough that the periodic sweep stays cheap.
 */
const MAX_TRACKED_BUCKETS = 20_000;

/** How often the amortized sweep may actually walk the Map. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * A minimal in-memory sliding-window limiter for the auth endpoints
 * (register/login/refresh have no other brute-force protection). No
 * external package here because no `@nestjs/throttler` release yet
 * supports Nest 12 in this environment — see package.json.
 *
 * Deliberately still in-process rather than Redis-backed. The API runs at
 * one replica, so a shared store would buy no accuracy today, and moving
 * auth rate limiting onto Redis forces a choice between failing open on a
 * Redis blip (silently dropping brute-force protection) and failing closed
 * (a cache outage takes down login). Neither is worth paying for a
 * correctness property this deployment doesn't currently need. Revisit when
 * replicas > 1 — at that point each process tracks its own count and the
 * effective limit becomes N x the configured one.
 *
 * Note this state is per-process and resets on deploy, which is acceptable
 * for the windows in use here (all <= 60s).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly hits = new Map<string, number[]>();
  private static lastSweepAt = Date.now();
  /**
   * Longest window any constructed guard uses. Tracked rather than hardcoded
   * so the sweep can never evict a bucket that is still inside its own
   * window — adding a route with a 15-minute limit stays correct with no
   * change here.
   */
  private static maxWindowMs = 0;

  constructor(private readonly options: RateLimitOptions) {
    RateLimitGuard.maxWindowMs = Math.max(RateLimitGuard.maxWindowMs, options.windowMs);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // req.ip, not req.socket.remoteAddress: main.ts sets `trust proxy` so
    // this is the real client address behind Railway's edge rather than the
    // proxy's — without that every visitor would share one bucket.
    const key = `${request.route?.path ?? request.path}:${request.ip}`;
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    RateLimitGuard.sweep(now);

    const existing = RateLimitGuard.hits.get(key) ?? [];
    const recent = existing.filter((timestamp) => timestamp > windowStart);

    if (recent.length >= this.options.limit) {
      // Keep the pruned window even on rejection, so a client that keeps
      // hammering doesn't grow an unbounded timestamp array.
      RateLimitGuard.hits.set(key, recent);
      throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    recent.push(now);
    RateLimitGuard.hits.set(key, recent);
    return true;
  }

  /**
   * Drops buckets whose newest hit has aged out of even the longest window
   * in use. Without this the Map grew one permanent entry per (route, IP)
   * ever seen: the timestamp arrays were pruned on access, but a key whose
   * client never returned was never removed, so the Map leaked for the life
   * of the process.
   *
   * Amortized onto request handling rather than a timer — no interval to
   * own, and a service with no auth traffic has nothing to sweep anyway.
   */
  private static sweep(now: number): void {
    const dueForSweep = now - RateLimitGuard.lastSweepAt >= SWEEP_INTERVAL_MS;
    if (!dueForSweep && RateLimitGuard.hits.size < MAX_TRACKED_BUCKETS) return;

    RateLimitGuard.lastSweepAt = now;
    const cutoff = now - RateLimitGuard.maxWindowMs;
    for (const [key, timestamps] of RateLimitGuard.hits) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
        RateLimitGuard.hits.delete(key);
      }
    }

    // Backstop for the pathological case where every bucket is still live
    // (a distributed attack). Dropping the oldest entries can only ever
    // forgive requests already counted, never invent new denials.
    if (RateLimitGuard.hits.size >= MAX_TRACKED_BUCKETS) {
      const excess = RateLimitGuard.hits.size - MAX_TRACKED_BUCKETS;
      let dropped = 0;
      for (const key of RateLimitGuard.hits.keys()) {
        if (dropped++ >= excess) break;
        RateLimitGuard.hits.delete(key);
      }
    }
  }

  /** Test-only: the guard's state is static and would otherwise leak between cases. */
  static resetForTests(): void {
    RateLimitGuard.hits.clear();
    RateLimitGuard.lastSweepAt = Date.now();
  }

  /** Test-only: lets a sweep assertion avoid waiting out SWEEP_INTERVAL_MS. */
  static get trackedBucketCount(): number {
    return RateLimitGuard.hits.size;
  }
}

/** Factory so each route can declare its own limit via @UseGuards(rateLimit({ limit, windowMs })). */
export function rateLimit(options: RateLimitOptions) {
  return new RateLimitGuard(options);
}
