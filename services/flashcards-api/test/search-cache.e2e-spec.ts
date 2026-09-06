import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Redis } from 'ioredis';
import { AppModule } from './../src/app.module.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { FlashcardSet, SetVisibility } from '../src/modules/flashcard-sets/entities/flashcard-set.entity.js';

const PASSWORD = 'password123';

/**
 * Real HTTP + real Postgres + real Redis. The unit specs prove the cache
 * logic in isolation; this file proves the three properties that only show
 * up when all three are wired together:
 *
 *   1. cache-aside actually round-trips through Redis (key, TTL, hit),
 *   2. a mutation invalidates rather than leaving a stale public listing,
 *   3. authorization survives the cache — a private/unlisted set never
 *      enters it, and one viewer never receives another viewer's state.
 *
 * Every key this file touches is created by the app under the normal
 * `search:` prefix and cleaned up explicitly. It never issues FLUSHDB or
 * FLUSHALL.
 */
describe('Explore search cache: Redis + PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let setsRepo: Repository<FlashcardSet>;
  let redis: Redis;

  const createdEmails: string[] = [];
  const createdSetIds: string[] = [];

  let ownerCookies: string[];
  let viewerCookies: string[];

  // Unique per run so a leftover row from a previous run can't satisfy an
  // assertion, and so each test owns its own cache key.
  const runId = `cachetest${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    setsRepo = moduleFixture.get(getRepositoryToken(FlashcardSet));

    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

    const owner = await createVerifiedUser('cache-owner');
    const viewer = await createVerifiedUser('cache-viewer');
    ownerCookies = await loginCookies(owner.email);
    viewerCookies = await loginCookies(viewer.email);
  });

  afterAll(async () => {
    for (const setId of createdSetIds) {
      await setsRepo.delete({ id: setId });
    }
    for (const email of createdEmails) {
      await usersRepo.delete({ email });
    }
    await clearSearchCache();
    redis.disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await clearSearchCache();
  });

  /** Same SCAN sweep the app uses — scoped to `search:`, never a FLUSH. */
  async function clearSearchCache(): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'search:*', 'COUNT', 500);
      cursor = next;
      if (keys.length > 0) await redis.unlink(...keys);
    } while (cursor !== '0');
  }

  /** Mirrors SearchService.buildSearchCacheKey — asserted against, not imported. */
  function cacheKeyFor(term: string, page = 1, limit = 20, category = 'any'): string {
    const hash = term === '' ? 'all' : createHash('sha256').update(term).digest('hex').slice(0, 16);
    return `search:v1:${category}:${page}:${limit}:${hash}`;
  }

  async function createVerifiedUser(emailPrefix: string) {
    const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdEmails.push(email);
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const user = await usersRepo.save(
      usersRepo.create({ email, displayName: 'Cache Test User', passwordHash, emailVerifiedAt: new Date() }),
    );
    return { email, user };
  }

  async function loginCookies(email: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response.get('Set-Cookie') as string[];
  }

  async function createSet(cookies: string[], visibility: SetVisibility, title: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/flashcard-sets')
      .set('Cookie', cookies)
      .send({ title, visibility });
    expect(response.status).toBe(201);
    createdSetIds.push(response.body.data.id);
    return response.body.data.id as string;
  }

  function search(cookies: string[], term: string) {
    return request(app.getHttpServer()).get(`/search?q=${encodeURIComponent(term)}`).set('Cookie', cookies);
  }

  describe('cache-aside round trip', () => {
    it('writes one namespaced, versioned, TTL-bounded key on a miss', async () => {
      const term = `${runId}-roundtrip`;
      await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Set`);

      const response = await search(viewerCookies, term);
      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);

      const key = cacheKeyFor(term);
      expect(await redis.exists(key)).toBe(1);

      // Every key must expire on its own — nothing here may live forever.
      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('serves the second identical request from Redis', async () => {
      const term = `${runId}-hit`;
      await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Set`);

      await search(viewerCookies, term);

      // Rewrite the cached value with a marker the database could never
      // produce. If the second response carries it, the read came from Redis.
      const key = cacheKeyFor(term);
      const cached = JSON.parse((await redis.get(key))!);
      cached.items[0].title = 'SERVED-FROM-CACHE';
      await redis.set(key, JSON.stringify(cached), 'EX', 60);

      const second = await search(viewerCookies, term);
      expect(second.body.data.items[0].title).toBe('SERVED-FROM-CACHE');
    });

    // The anti-collision property, tested by contamination rather than by
    // key presence: if two terms could ever share a key, the marker planted
    // under one would surface under the other.
    it('keys different search terms independently', async () => {
      await createSet(ownerCookies, SetVisibility.PUBLIC, `${runId}-alpha Set`);
      await createSet(ownerCookies, SetVisibility.PUBLIC, `${runId}-beta Set`);

      await search(viewerCookies, `${runId}-alpha`);
      const alphaKey = cacheKeyFor(`${runId}-alpha`);
      const alphaCached = JSON.parse((await redis.get(alphaKey))!);
      alphaCached.items[0].title = 'ALPHA-CACHE-MARKER';
      await redis.set(alphaKey, JSON.stringify(alphaCached), 'EX', 60);

      const beta = await search(viewerCookies, `${runId}-beta`);

      expect(cacheKeyFor(`${runId}-beta`)).not.toBe(alphaKey);
      expect(beta.body.data.items[0].title).toBe(`${runId}-beta Set`);
      expect(JSON.stringify(beta.body)).not.toContain('ALPHA-CACHE-MARKER');
    });
  });

  describe('invalidation on mutation', () => {
    it('drops a set from Explore immediately when its owner makes it private', async () => {
      const term = `${runId}-hide`;
      const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Set`);

      const before = await search(viewerCookies, term);
      expect(before.body.data.items).toHaveLength(1);
      expect(await redis.exists(cacheKeyFor(term))).toBe(1);

      const update = await request(app.getHttpServer())
        .patch(`/flashcard-sets/${setId}`)
        .set('Cookie', ownerCookies)
        .send({ visibility: SetVisibility.PRIVATE });
      expect(update.status).toBe(200);

      // The cached page must be gone, not waiting out its TTL — a set the
      // owner just hid cannot stay discoverable for another minute.
      expect(await redis.exists(cacheKeyFor(term))).toBe(0);

      const after = await search(viewerCookies, term);
      expect(after.body.data.items).toHaveLength(0);
    });

    it('reflects a title change in Explore immediately', async () => {
      const term = `${runId}-rename`;
      const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Original`);

      await search(viewerCookies, term);

      await request(app.getHttpServer())
        .patch(`/flashcard-sets/${setId}`)
        .set('Cookie', ownerCookies)
        .send({ title: `${term} Renamed` })
        .expect(200);

      const after = await search(viewerCookies, term);
      expect(after.body.data.items[0].title).toBe(`${term} Renamed`);
    });

    it('drops a deleted set from Explore immediately', async () => {
      const term = `${runId}-delete`;
      const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Set`);

      await search(viewerCookies, term);
      await request(app.getHttpServer()).delete(`/flashcard-sets/${setId}`).set('Cookie', ownerCookies).expect(204);

      const after = await search(viewerCookies, term);
      expect(after.body.data.items).toHaveLength(0);
    });
  });

  describe('authorization boundaries survive the cache', () => {
    it('never lets a private set into Explore or into Redis', async () => {
      const term = `${runId}-private`;
      await createSet(ownerCookies, SetVisibility.PRIVATE, `${term} Set`);

      // The owner searching cannot surface their own private set either —
      // Explore is public-only by construction.
      const asOwner = await search(ownerCookies, term);
      expect(asOwner.body.data.items).toHaveLength(0);

      const asViewer = await search(viewerCookies, term);
      expect(asViewer.body.data.items).toHaveLength(0);

      const cached = await redis.get(cacheKeyFor(term));
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!).items).toHaveLength(0);
      expect(cached).not.toContain(`${term} Set`);
    });

    it('never lets an unlisted set become publicly discoverable through the cache', async () => {
      const term = `${runId}-unlisted`;
      await createSet(ownerCookies, SetVisibility.UNLISTED, `${term} Set`);

      const response = await search(viewerCookies, term);
      expect(response.body.data.items).toHaveLength(0);
      expect(await redis.get(cacheKeyFor(term))).not.toContain(`${term} Set`);
    });

    it('never stores the owner\'s email or password hash in Redis', async () => {
      const term = `${runId}-leak`;
      await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Set`);

      await search(viewerCookies, term);

      const owner = await usersRepo.findOne({ where: { email: createdEmails[0] } });
      const cached = (await redis.get(cacheKeyFor(term)))!;
      expect(cached).not.toContain(owner!.email);
      expect(cached).not.toContain(owner!.passwordHash!);
      expect(cached).not.toContain('passwordHash');
    });

    // The shared entry is only safe because per-viewer state is computed
    // outside it. User A liking a set must not make it appear liked to B.
    it('gives each viewer their own like state from one shared cache entry', async () => {
      const term = `${runId}-isolation`;
      const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Set`);

      await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies).expect(201);

      const asOwner = await search(ownerCookies, term);
      const asViewer = await search(viewerCookies, term);

      // Both served the same cached page...
      expect(await redis.exists(cacheKeyFor(term))).toBe(1);
      // ...but each sees their own like state.
      expect(asOwner.body.data.items[0].likedByCurrentUser).toBe(true);
      expect(asViewer.body.data.items[0].likedByCurrentUser).toBe(false);

      // And viewer identity never reaches the key or the value.
      const cached = (await redis.get(cacheKeyFor(term)))!;
      expect(cached).not.toContain('likedByCurrentUser');
    });

    it('still requires authentication — the cache is not an unauthenticated bypass', async () => {
      const term = `${runId}-authz`;
      await createSet(ownerCookies, SetVisibility.PUBLIC, `${term} Set`);
      await search(viewerCookies, term); // populate

      await request(app.getHttpServer()).get(`/search?q=${encodeURIComponent(term)}`).expect(401);
    });
  });

  describe('input bounds', () => {
    it('rejects a search term long enough to bloat the keyspace', async () => {
      await request(app.getHttpServer())
        .get(`/search?q=${'x'.repeat(201)}`)
        .set('Cookie', viewerCookies)
        .expect(400);
    });

    it('accepts a term at the cap', async () => {
      await request(app.getHttpServer())
        .get(`/search?q=${'x'.repeat(200)}`)
        .set('Cookie', viewerCookies)
        .expect(200);
    });
  });
});
