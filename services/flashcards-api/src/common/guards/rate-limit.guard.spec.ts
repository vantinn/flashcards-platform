import { HttpException, type ExecutionContext } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimitGuard, rateLimit } from './rate-limit.guard.js';

/**
 * Shaped like a real Railway request: the TCP peer is Railway's internal
 * proxy (a private 100.64/10 address) and the client address arrives in
 * X-Real-IP. `proxyHop` varies per call to model the detail that broke the
 * limiter in production — the internal hop is not stable, so anything
 * bucketing on it counts every request separately. See client-ip.ts.
 */
let proxyHop = 0;
function contextFor(ip: string, path = '/auth/login'): ExecutionContext {
  proxyHop += 1;
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        socket: { remoteAddress: `100.64.0.${proxyHop % 250}` },
        headers: { 'x-real-ip': ip, 'x-forwarded-for': `${ip}, 100.64.0.${proxyHop % 250}` },
        path,
        route: { path },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  beforeEach(() => {
    RateLimitGuard.resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    RateLimitGuard.resetForTests();
  });

  it('allows requests up to the limit and rejects the one past it', () => {
    const guard = rateLimit({ limit: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i += 1) {
      expect(guard.canActivate(contextFor('1.2.3.4'))).toBe(true);
    }

    expect(() => guard.canActivate(contextFor('1.2.3.4'))).toThrow(HttpException);
  });

  it('counts each client IP separately — one attacker cannot lock everyone else out', () => {
    const guard = rateLimit({ limit: 2, windowMs: 60_000 });

    guard.canActivate(contextFor('1.2.3.4'));
    guard.canActivate(contextFor('1.2.3.4'));
    expect(() => guard.canActivate(contextFor('1.2.3.4'))).toThrow(HttpException);

    // A different client is untouched by the first one's exhausted bucket.
    expect(guard.canActivate(contextFor('5.6.7.8'))).toBe(true);
  });

  // The production regression this guards against: rotating a forwarding
  // header must not mint fresh buckets. The proxy-written X-Real-IP is what
  // decides the bucket, so a client rotating X-Forwarded-For gets nowhere.
  it('cannot be bypassed by rotating X-Forwarded-For behind the proxy', () => {
    const guard = rateLimit({ limit: 3, windowMs: 60_000 });

    function spoofing(attempt: number): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            socket: { remoteAddress: '100.64.0.7' },
            headers: {
              'x-real-ip': '203.0.113.7',
              'x-forwarded-for': `198.51.100.${attempt}, 203.0.113.7, 100.64.0.7`,
            },
            path: '/auth/login',
            route: { path: '/auth/login' },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    for (let i = 0; i < 3; i += 1) {
      expect(guard.canActivate(spoofing(i))).toBe(true);
    }

    expect(() => guard.canActivate(spoofing(99))).toThrow(HttpException);
  });

  it('counts each route separately', () => {
    const guard = rateLimit({ limit: 1, windowMs: 60_000 });

    expect(guard.canActivate(contextFor('1.2.3.4', '/auth/login'))).toBe(true);
    expect(guard.canActivate(contextFor('1.2.3.4', '/auth/register'))).toBe(true);
  });

  it('lets a client through again once its window has passed', () => {
    vi.useFakeTimers();
    const guard = rateLimit({ limit: 1, windowMs: 60_000 });

    expect(guard.canActivate(contextFor('1.2.3.4'))).toBe(true);
    expect(() => guard.canActivate(contextFor('1.2.3.4'))).toThrow(HttpException);

    vi.advanceTimersByTime(60_001);
    expect(guard.canActivate(contextFor('1.2.3.4'))).toBe(true);
  });

  it('does not extend a blocked client\'s window on every rejected retry', () => {
    vi.useFakeTimers();
    const guard = rateLimit({ limit: 1, windowMs: 60_000 });

    guard.canActivate(contextFor('1.2.3.4'));

    // Hammer while blocked — rejections must not count as hits, or a client
    // that keeps retrying could never recover.
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 20; i += 1) {
      expect(() => guard.canActivate(contextFor('1.2.3.4'))).toThrow(HttpException);
    }

    vi.advanceTimersByTime(30_001);
    expect(guard.canActivate(contextFor('1.2.3.4'))).toBe(true);
  });

  // Before the sweep, every (route, IP) ever seen left a permanent Map entry:
  // the timestamp arrays were pruned on access, but a key whose client never
  // came back was never removed, so the Map grew for the life of the process.
  it('evicts buckets whose clients have gone away, instead of growing forever', () => {
    vi.useFakeTimers();
    const guard = rateLimit({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 500; i += 1) {
      guard.canActivate(contextFor(`10.0.${Math.floor(i / 256)}.${i % 256}`));
    }
    expect(RateLimitGuard.trackedBucketCount).toBe(500);

    // Past the longest configured window, so none of those buckets is live.
    vi.advanceTimersByTime(120_000);
    guard.canActivate(contextFor('192.168.0.1'));

    expect(RateLimitGuard.trackedBucketCount).toBe(1);
  });

  it('never evicts a bucket that is still inside its own window', () => {
    vi.useFakeTimers();
    const guard = rateLimit({ limit: 2, windowMs: 60_000 });

    guard.canActivate(contextFor('1.2.3.4'));
    guard.canActivate(contextFor('1.2.3.4'));

    // Force a sweep at a point where the bucket is still live.
    vi.advanceTimersByTime(59_000);
    guard.canActivate(contextFor('9.9.9.9'));

    expect(() => guard.canActivate(contextFor('1.2.3.4'))).toThrow(HttpException);
  });
});
