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
 *
 * PostgreSQL stays the source of truth for everything. Nothing that isn't
 * rebuildable from a Postgres query is ever written here, so losing the
 * whole keyspace costs a few slower requests and nothing else.
 */

/** How often the throttled hit/miss summary may be logged. */
const STATS_LOG_INTERVAL_MS = 5 * 60 * 1000;

/** Ceiling on one SCAN+UNLINK sweep, so invalidation can't run unbounded. */
const SCAN_BATCH = 500;
const SCAN_MAX_ITERATIONS = 200;

export interface CacheStats {
  enabled: boolean;
  status: string;
  hits: number;
  misses: number;
  errors: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  /** null when no REDIS_URL is configured — the cache is then a permanent no-op. */
  private readonly client: Redis | null;

  private hits = 0;
  private misses = 0;
  private errors = 0;
  private lastStatsLogAt = Date.now();
  private statsTimer: NodeJS.Timeout | null = null;

  // Connection-lifecycle logging is edge-triggered, not per-event: a Redis
  // that flaps every few seconds would otherwise fill Railway's log stream
  // with identical lines and bury everything that matters.
  private connected = false;
  private loggedConnectionError = false;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('redis.url');

    if (!url) {
      this.client = null;
      this.logger.warn('REDIS_URL is not set — caching is disabled, all reads go to PostgreSQL.');
      return;
    }

    this.client = new Redis(url, {
      // Fail a request quickly instead of queueing it while disconnected —
      // callers here always have a DB fallback, so a fast miss beats a slow
      // one.
      maxRetriesPerRequest: 1,
      // The backstop maxRetriesPerRequest can't provide: it only fires once
      // ioredis knows the connection is down. A connected-but-unresponsive
      // server needs a wall-clock bound or the HTTP request hangs on it.
      commandTimeout: configService.get<number>('redis.commandTimeoutMs') ?? 250,
      connectTimeout: configService.get<number>('redis.connectTimeoutMs') ?? 5000,
      // Don't hold commands in memory while disconnected and replay them
      // later — by the time they'd flush, the caller has long since been
      // served from Postgres. Erroring immediately is the honest answer.
      enableOfflineQueue: false,
      // Capped backoff with jitter. Deliberately never gives up: this client
      // lives for the whole process, and permanently disabling the cache
      // after a transient outage would be a silent, unrecoverable
      // degradation until the next deploy. Per-request latency is bounded by
      // commandTimeout above, which is the thing that actually protects
      // callers. Jitter keeps N instances from reconnecting in lockstep.
      retryStrategy: (attempt: number) => Math.min(attempt * 500, 5000) + Math.floor(Math.random() * 250),
      lazyConnect: false,
    });

    this.client.on('error', (error: Error) => {
      this.errors += 1;
      if (!this.loggedConnectionError) {
        this.logger.warn(`Redis unavailable, falling back to uncached reads: ${error.message}`);
        this.loggedConnectionError = true;
      }
    });
    this.client.on('ready', () => {
      this.loggedConnectionError = false;
      if (!this.connected) {
        this.connected = true;
        this.logger.log('Redis connected — Explore search caching is active.');
      }
    });
    this.client.on('end', () => {
      if (this.connected) {
        this.connected = false;
        this.logger.warn('Redis connection closed — serving uncached reads until it recovers.');
      }
    });

    // One periodic, throttled line instead of logging per operation. Silent
    // while idle, so it costs nothing on a quiet service but makes hit rate
    // and error count visible in Railway logs without any metrics stack.
    this.statsTimer = setInterval(() => this.logStats(), STATS_LOG_INTERVAL_MS);
    this.statsTimer.unref();
  }

  /** Counters for health checks and tests. Never includes cached values or keys. */
  getStats(): CacheStats {
    return {
      enabled: this.client !== null,
      status: this.client?.status ?? 'disabled',
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
    };
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (raw === null) {
        this.misses += 1;
        return null;
      }
      this.hits += 1;
      return JSON.parse(raw) as T;
    } catch {
      // Covers connection loss, command timeout, and unparseable payloads
      // (e.g. a value written by an older deploy). All three mean the same
      // thing to the caller: treat it as a miss and read Postgres.
      this.errors += 1;
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Best-effort — a failed write just means the next read misses too.
      // Never fails the business operation that produced the value.
      this.errors += 1;
    }
  }

  /**
   * Coarse invalidation for a family of cached keys sharing a prefix (e.g.
   * all search result pages).
   *
   * Uses SCAN, never KEYS: KEYS walks the entire keyspace in one shot and
   * blocks Redis's single thread for the whole walk, which would stall every
   * other client on the instance — and this runs on every flashcard-set
   * create/update/delete. SCAN does the same work incrementally, yielding
   * between batches. UNLINK frees the values on a background thread rather
   * than inline with DEL.
   *
   * The iteration cap means a pathologically large keyspace degrades to a
   * partial sweep rather than an unbounded stall; anything missed still
   * expires on its own TTL, which is why every key written here has one.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    if (!this.client) return;
    try {
      let cursor = '0';
      let iterations = 0;
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', SCAN_BATCH);
        cursor = next;
        if (keys.length > 0) {
          await this.client.unlink(...keys);
        }
        iterations += 1;
      } while (cursor !== '0' && iterations < SCAN_MAX_ITERATIONS);
    } catch {
      // Worst case a stale entry lives out its TTL — see class doc.
      this.errors += 1;
    }
  }

  private logStats(): void {
    const total = this.hits + this.misses;
    if (total === 0 && this.errors === 0) return; // Stay quiet on an idle service.

    const elapsedMinutes = Math.round((Date.now() - this.lastStatsLogAt) / 60000);
    const hitRate = total > 0 ? Math.round((this.hits / total) * 100) : 0;
    this.logger.log(
      `Cache ${elapsedMinutes}m: hits=${this.hits} misses=${this.misses} hitRate=${hitRate}% errors=${this.errors}`,
    );
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
    this.lastStatsLogAt = Date.now();
  }

  /**
   * Runs on SIGTERM/SIGINT via app.enableShutdownHooks() (see main.ts).
   * quit() drains in-flight commands and closes cleanly; it can itself hang
   * against an unresponsive server, so it races a short timer and falls back
   * to a hard disconnect — shutdown must always finish.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (!this.client) return;

    try {
      await Promise.race([
        this.client.quit(),
        new Promise((resolve) => setTimeout(resolve, 1000).unref()),
      ]);
    } catch {
      // Already disconnected — nothing to drain.
    } finally {
      this.client.disconnect();
    }
  }
}
