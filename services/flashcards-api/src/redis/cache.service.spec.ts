import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from './cache.service.js';

// The Redis client is replaced wholesale — these tests must never open a
// socket, and every behaviour worth asserting here (fail-soft degradation,
// SCAN-based invalidation, connection options) is observable from the calls
// the service makes against it. Same shape as EmailService's Resend mock.
const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
  scan: vi.fn(),
  unlink: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  status: 'ready',
};

const redisConstructor = vi.fn();

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(function MockRedis(url: string, options: unknown) {
    redisConstructor(url, options);
    return redisMock;
  }),
}));

function buildConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'redis.url': 'redis://localhost:6379',
    'redis.commandTimeoutMs': 250,
    'redis.connectTimeoutMs': 5000,
    ...overrides,
  };
  return { get: (key: string) => values[key] };
}

async function buildService(config: ReturnType<typeof buildConfig> = buildConfig()) {
  const moduleRef = await Test.createTestingModule({
    providers: [CacheService, { provide: ConfigService, useValue: config }],
  }).compile();
  return moduleRef.get(CacheService);
}

describe('CacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    redisMock.scan.mockResolvedValue(['0', []]);
    redisMock.unlink.mockResolvedValue(1);
    redisMock.quit.mockResolvedValue('OK');
  });

  describe('connection configuration', () => {
    it('bounds every command with a timeout so a hung Redis cannot hang an HTTP request', async () => {
      await buildService();

      const [, options] = redisConstructor.mock.calls[0];
      expect(options.commandTimeout).toBe(250);
      expect(options.connectTimeout).toBe(5000);
    });

    it('refuses to queue commands while disconnected — callers read PostgreSQL instead of waiting', async () => {
      await buildService();

      const [, options] = redisConstructor.mock.calls[0];
      expect(options.enableOfflineQueue).toBe(false);
      expect(options.maxRetriesPerRequest).toBe(1);
    });

    it('caps reconnect backoff and keeps retrying, so a transient outage self-heals', async () => {
      await buildService();

      const [, options] = redisConstructor.mock.calls[0];
      // Never null: returning null would disable the cache permanently until
      // the next deploy. Bounded: no unbounded growth in reconnect delay.
      for (const attempt of [1, 5, 50, 5000]) {
        const delay = options.retryStrategy(attempt);
        expect(typeof delay).toBe('number');
        expect(delay).toBeGreaterThan(0);
        expect(delay).toBeLessThanOrEqual(5250);
      }
    });
  });

  describe('when REDIS_URL is not configured', () => {
    it('never constructs a client and reports itself disabled', async () => {
      const service = await buildService(buildConfig({ 'redis.url': null }));

      expect(redisConstructor).not.toHaveBeenCalled();
      expect(service.getStats()).toMatchObject({ enabled: false, status: 'disabled' });
    });

    it('degrades every operation to a no-op rather than throwing', async () => {
      const service = await buildService(buildConfig({ 'redis.url': null }));

      await expect(service.getJson('search:v1:any:1:20:all')).resolves.toBeNull();
      await expect(service.setJson('k', { a: 1 }, 60)).resolves.toBeUndefined();
      await expect(service.deleteByPrefix('search:')).resolves.toBeUndefined();
      expect(redisMock.get).not.toHaveBeenCalled();
    });
  });

  describe('getJson', () => {
    it('returns the parsed value and counts a hit', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify({ items: [{ id: 'set-1' }] }));
      const service = await buildService();

      await expect(service.getJson('search:v1:any:1:20:all')).resolves.toEqual({ items: [{ id: 'set-1' }] });
      expect(service.getStats()).toMatchObject({ hits: 1, misses: 0, errors: 0 });
    });

    it('counts a miss when the key is absent', async () => {
      const service = await buildService();

      await expect(service.getJson('missing')).resolves.toBeNull();
      expect(service.getStats()).toMatchObject({ hits: 0, misses: 1 });
    });

    it('falls back to a miss when Redis errors, so the caller can read PostgreSQL', async () => {
      redisMock.get.mockRejectedValue(new Error('Command timed out'));
      const service = await buildService();

      await expect(service.getJson('search:v1:any:1:20:all')).resolves.toBeNull();
      expect(service.getStats()).toMatchObject({ errors: 1 });
    });

    it('treats an unparseable value as a miss rather than propagating a SyntaxError', async () => {
      redisMock.get.mockResolvedValue('{not json');
      const service = await buildService();

      await expect(service.getJson('search:v1:any:1:20:all')).resolves.toBeNull();
    });
  });

  describe('setJson', () => {
    it('always writes with an explicit TTL', async () => {
      const service = await buildService();

      await service.setJson('search:v1:any:1:20:all', { items: [] }, 60);

      expect(redisMock.set).toHaveBeenCalledWith('search:v1:any:1:20:all', '{"items":[]}', 'EX', 60);
    });

    it('never fails the business operation when the cache write fails', async () => {
      redisMock.set.mockRejectedValue(new Error('READONLY'));
      const service = await buildService();

      await expect(service.setJson('k', { a: 1 }, 60)).resolves.toBeUndefined();
      expect(service.getStats()).toMatchObject({ errors: 1 });
    });
  });

  describe('deleteByPrefix', () => {
    it('uses SCAN, never KEYS — KEYS would block the whole Redis instance', async () => {
      redisMock.scan.mockResolvedValue(['0', ['search:v1:any:1:20:all']]);
      const service = await buildService();

      await service.deleteByPrefix('search:');

      expect(redisMock.scan).toHaveBeenCalledWith('0', 'MATCH', 'search:*', 'COUNT', 500);
      expect(redisMock).not.toHaveProperty('keys');
      expect(redisMock.unlink).toHaveBeenCalledWith('search:v1:any:1:20:all');
    });

    it('follows the cursor across batches until it wraps to 0', async () => {
      redisMock.scan
        .mockResolvedValueOnce(['42', ['search:a']])
        .mockResolvedValueOnce(['0', ['search:b']]);
      const service = await buildService();

      await service.deleteByPrefix('search:');

      expect(redisMock.scan).toHaveBeenCalledTimes(2);
      expect(redisMock.unlink).toHaveBeenCalledTimes(2);
    });

    it('issues no delete when a batch matches nothing', async () => {
      const service = await buildService();

      await service.deleteByPrefix('search:');

      expect(redisMock.unlink).not.toHaveBeenCalled();
    });

    it('stops after a bounded number of iterations rather than sweeping forever', async () => {
      // A cursor that never returns to '0' — a pathologically large keyspace.
      redisMock.scan.mockResolvedValue(['99', ['search:x']]);
      const service = await buildService();

      await service.deleteByPrefix('search:');

      expect(redisMock.scan).toHaveBeenCalledTimes(200);
    });

    it('swallows a failed sweep — stale entries still expire on their own TTL', async () => {
      redisMock.scan.mockRejectedValue(new Error('CLUSTERDOWN'));
      const service = await buildService();

      await expect(service.deleteByPrefix('search:')).resolves.toBeUndefined();
      expect(service.getStats()).toMatchObject({ errors: 1 });
    });
  });

  describe('shutdown', () => {
    it('drains in-flight commands with quit, then disconnects', async () => {
      const service = await buildService();

      await service.onModuleDestroy();

      expect(redisMock.quit).toHaveBeenCalled();
      expect(redisMock.disconnect).toHaveBeenCalled();
    });

    it('still completes shutdown when quit rejects against a dead connection', async () => {
      redisMock.quit.mockRejectedValue(new Error('Connection is closed'));
      const service = await buildService();

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(redisMock.disconnect).toHaveBeenCalled();
    });
  });

  it('exposes counters without ever exposing cached values or keys', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ secret: 'value' }));
    const service = await buildService();
    await service.getJson('search:v1:any:1:20:all');

    expect(Object.keys(service.getStats()).sort()).toEqual(['enabled', 'errors', 'hits', 'misses', 'status']);
  });
});
