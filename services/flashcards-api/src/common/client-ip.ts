import type { Request } from 'express';

/**
 * Resolves the address a request should be rate-limited against.
 *
 * Express's `trust proxy` hop counting is not usable here. It requires
 * knowing exactly how many proxies sit in front of the app, and on Railway
 * that number is neither documented nor stable — measured against the
 * production deployment, the rightmost X-Forwarded-For entry changes from
 * request to request (it is an internal proxy address, not the client), so
 * a fixed hop count silently gives every request its own bucket and the
 * limiter stops limiting anything.
 *
 * So the client address is derived explicitly instead:
 *
 *  1. If the immediate TCP peer is a public address, the app is directly
 *     exposed to the internet. Any forwarding header is then attacker-
 *     supplied and must be ignored — the peer address is the only truth.
 *  2. If the peer is private/loopback, a reverse proxy on the local network
 *     is in front (Railway's edge, docker-compose, a dev proxy), and its
 *     headers can be trusted. X-Real-IP is preferred: Railway documents it
 *     as the single source of truth for the connecting IP, it is written by
 *     the edge, and it is a single value with no chain to mis-parse.
 *  3. Failing that, the leftmost X-Forwarded-For entry — the original client
 *     as recorded by the first proxy that saw it.
 *
 * A client cannot reach case 2 or 3 without first passing through a proxy
 * that overwrites these headers, so spoofing them does not move the bucket.
 */
export function resolveClientIp(request: Request): string {
  const peer = request.socket?.remoteAddress ?? '';

  if (!peer || !isPrivateAddress(peer)) {
    return normalizeForBucketing(peer || 'unknown');
  }

  const realIp = firstHeaderValue(request.headers['x-real-ip']);
  if (realIp) return normalizeForBucketing(realIp);

  const forwardedFor = firstHeaderValue(request.headers['x-forwarded-for']);
  if (forwardedFor) {
    const leftmost = forwardedFor.split(',')[0]?.trim();
    if (leftmost) return normalizeForBucketing(leftmost);
  }

  return normalizeForBucketing(peer);
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Buckets IPv6 clients by /64 rather than by exact address.
 *
 * A residential or cloud IPv6 client is routinely handed a whole /64 and can
 * rotate through billions of addresses inside it at no cost, which would let
 * it bypass a per-address limit entirely. /64 is the smallest block that is
 * reliably one subscriber, so it is the right unit for "one client".
 * IPv4 addresses are already one-per-client and pass through untouched.
 */
function normalizeForBucketing(address: string): string {
  const ip = stripIpv4MappedPrefix(address);
  if (!ip.includes(':')) return ip;

  // Strip any zone index (fe80::1%eth0) before splitting.
  const [bare] = ip.split('%');
  const expanded = expandIpv6(bare);
  return expanded ? `${expanded.slice(0, 4).join(':')}::/64` : ip;
}

/** `::ffff:203.0.113.7` is an IPv4 client on a dual-stack socket, not an IPv6 one. */
function stripIpv4MappedPrefix(address: string): string {
  const match = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  return match ? match[1] : address;
}

/** Returns the 8 hextets of an IPv6 address, or null if it isn't parseable. */
function expandIpv6(address: string): string[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }

  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array<string>(missing).fill('0'), ...tail];
}

/**
 * Whether an address belongs to a local/private network — i.e. whether the
 * peer is plausibly a reverse proxy rather than an internet client.
 * Includes 100.64.0.0/10 (carrier-grade NAT), which is the range Railway's
 * internal proxies sit in, and fc00::/7 (IPv6 unique local), which is what
 * Railway's private network uses.
 */
function isPrivateAddress(address: string): boolean {
  const ip = stripIpv4MappedPrefix(address).split('%')[0];

  if (ip === '::1' || ip === '::') return true;

  if (ip.includes(':')) {
    const first = expandIpv6(ip)?.[0];
    if (!first) return false;
    const leading = parseInt(first, 16);
    if (Number.isNaN(leading)) return false;
    // fc00::/7 (unique local) or fe80::/10 (link local)
    return (leading & 0xfe00) === 0xfc00 || (leading & 0xffc0) === 0xfe80;
  }

  const octets = ip.split('.').map((part) => parseInt(part, 10));
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) return false;

  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}
