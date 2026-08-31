import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/**
 * A thin, fail-soft cache-aside wrapper around Redis. "Fail-soft" is the
 * important property: Redis here is a read-through optimization for one
 * read-heavy, non-personalized endpoint (public search), not a system of
 * record. If Redis is slow, down, or simply not configured, every method
 * degrades to a no-op (get -> miss, set -> ignored) instead of throwing —
 * a cache outage must never take the API down with it.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private loggedConnectionError = false;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('redis.url');
    this.client = new Redis(url ?? 'redis://localhost:6379', {
      // Fail a request quickly instead of queueing it while disconnected —
      // callers here always have a DB fallback, so a fast miss beats a slow
      // one.
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt: number) => Math.min(attempt * 500, 5000),
      lazyConnect: false,
    });

    this.client.on('error', (error: Error) => {
      if (!this.loggedConnectionError) {
        this.logger.warn(`Redis unavailable, falling back to uncached reads: ${error.message}`);
        this.loggedConnectionError = true;
      }
    });
    this.client.on('connect', () => {
      this.loggedConnectionError = false;
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Best-effort — a failed write just means the next read misses too.
    }
  }

  /** Coarse invalidation for a family of cached keys sharing a prefix (e.g. all search result pages). */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // Worst case a stale entry lives out its TTL — see class doc.
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
