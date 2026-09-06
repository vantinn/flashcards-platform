import type { Request } from 'express';
import { describe, it, expect } from 'vitest';
import { resolveClientIp } from './client-ip.js';

function req(peer: string, headers: Record<string, string | string[]> = {}): Request {
  return { socket: { remoteAddress: peer }, headers } as unknown as Request;
}

describe('resolveClientIp', () => {
  // The case that matters most: if the app is reachable directly, forwarding
  // headers are attacker-supplied and must not move the rate-limit bucket.
  describe('when the peer is a public address (no proxy in front)', () => {
    it('ignores X-Real-IP and X-Forwarded-For entirely', () => {
      const request = req('203.0.113.7', {
        'x-real-ip': '198.51.100.1',
        'x-forwarded-for': '198.51.100.2, 198.51.100.3',
      });

      expect(resolveClientIp(request)).toBe('203.0.113.7');
    });

    it('gives a header-rotating attacker exactly one bucket', () => {
      const seen = new Set(
        [1, 2, 3, 4, 5].map((n) => resolveClientIp(req('203.0.113.7', { 'x-forwarded-for': `198.51.100.${n}` }))),
      );

      expect(seen.size).toBe(1);
    });
  });

  describe('when the peer is a private address (behind a reverse proxy)', () => {
    it('prefers X-Real-IP, the header Railway documents as the connecting IP', () => {
      const request = req('100.64.0.5', {
        'x-real-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.1, 100.64.0.9',
      });

      expect(resolveClientIp(request)).toBe('203.0.113.7');
    });

    // The rightmost entry is an internal proxy that changes per request on
    // Railway — taking it is what silently disabled the limiter.
    it('takes the leftmost X-Forwarded-For entry, never the rightmost', () => {
      const request = req('100.64.0.5', { 'x-forwarded-for': '203.0.113.7, 100.64.0.9, 100.64.0.11' });

      expect(resolveClientIp(request)).toBe('203.0.113.7');
    });

    it('buckets consistently even as the internal proxy hop changes', () => {
      const seen = new Set(
        [9, 10, 11, 12].map((n) => resolveClientIp(req('100.64.0.5', { 'x-forwarded-for': `203.0.113.7, 100.64.0.${n}` }))),
      );

      expect(seen.size).toBe(1);
      expect([...seen][0]).toBe('203.0.113.7');
    });

    it('falls back to the peer address when no forwarding header is present', () => {
      expect(resolveClientIp(req('10.0.0.4'))).toBe('10.0.0.4');
    });

    it('treats Railway\'s IPv6 private network as a proxy peer', () => {
      const request = req('fd12:7bd8:aabf:1:b000:179:fd7a:abe7', { 'x-real-ip': '203.0.113.7' });

      expect(resolveClientIp(request)).toBe('203.0.113.7');
    });

    it('ignores an empty or whitespace-only header rather than bucketing on it', () => {
      expect(resolveClientIp(req('10.0.0.4', { 'x-real-ip': '   ' }))).toBe('10.0.0.4');
    });
  });

  describe('address normalization', () => {
    it('unwraps an IPv4-mapped IPv6 peer to the plain IPv4 address', () => {
      expect(resolveClientIp(req('::ffff:203.0.113.7'))).toBe('203.0.113.7');
    });

    it('still recognises an IPv4-mapped private peer as private', () => {
      expect(resolveClientIp(req('::ffff:10.0.0.4', { 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    });

    // An IPv6 client is routinely handed a whole /64 and can rotate through
    // it for free, so a per-address bucket would be no limit at all.
    it('buckets an IPv6 client by /64, not by exact address', () => {
      const seen = new Set(
        ['2001:db8:1:2::1', '2001:db8:1:2::2', '2001:db8:1:2:aaaa:bbbb:cccc:dddd'].map((ip) =>
          resolveClientIp(req('100.64.0.5', { 'x-real-ip': ip })),
        ),
      );

      expect(seen.size).toBe(1);
      expect([...seen][0]).toBe('2001:db8:1:2::/64');
    });

    it('keeps different IPv6 /64s in different buckets', () => {
      const a = resolveClientIp(req('100.64.0.5', { 'x-real-ip': '2001:db8:1:2::1' }));
      const b = resolveClientIp(req('100.64.0.5', { 'x-real-ip': '2001:db8:1:3::1' }));

      expect(a).not.toBe(b);
    });

    it('does not collapse distinct IPv4 clients', () => {
      const a = resolveClientIp(req('100.64.0.5', { 'x-real-ip': '203.0.113.7' }));
      const b = resolveClientIp(req('100.64.0.5', { 'x-real-ip': '203.0.113.8' }));

      expect(a).not.toBe(b);
    });
  });

  it('never returns an empty key, even with no peer address at all', () => {
    expect(resolveClientIp({ socket: {}, headers: {} } as unknown as Request)).toBe('unknown');
  });
});
