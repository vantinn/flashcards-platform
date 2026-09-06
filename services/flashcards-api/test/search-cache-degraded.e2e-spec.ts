import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { User } from '../src/modules/users/entities/user.entity.js';
import { FlashcardSet, SetVisibility } from '../src/modules/flashcard-sets/entities/flashcard-set.entity.js';

const PASSWORD = 'password123';

/**
 * The whole point of the fail-soft design: Redis is a performance layer, not
 * an availability dependency. This boots the real application against a
 * Redis that isn't there (a closed port on localhost — nothing is listening,
 * so every command fails fast) and asserts the API is fully functional
 * anyway, reading through to PostgreSQL.
 *
 * Vitest isolates each test file in its own process, so pointing REDIS_URL at
 * a dead port here cannot affect the other e2e specs.
 */
describe('Explore search with Redis unavailable (e2e)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let setsRepo: Repository<FlashcardSet>;

  const createdEmails: string[] = [];
  const createdSetIds: string[] = [];
  const runId = `degraded${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

  let ownerCookies: string[];

  beforeAll(async () => {
    // Port 1 is reserved and never listening — a connection refused on every
    // attempt, which is exactly what a Redis outage looks like to the client.
    process.env.REDIS_URL = 'redis://127.0.0.1:1';

    // Imported after the env var is set so the config factory picks it up.
    const { AppModule } = await import('./../src/app.module.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    setsRepo = moduleFixture.get(getRepositoryToken(FlashcardSet));

    const email = `${runId}@example.com`;
    createdEmails.push(email);
    await usersRepo.save(
      usersRepo.create({
        email,
        displayName: 'Degraded Test User',
        passwordHash: await bcrypt.hash(PASSWORD, 12),
        emailVerifiedAt: new Date(),
      }),
    );

    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    ownerCookies = login.get('Set-Cookie') as string[];
  });

  afterAll(async () => {
    for (const setId of createdSetIds) {
      await setsRepo.delete({ id: setId });
    }
    for (const email of createdEmails) {
      await usersRepo.delete({ email });
    }
    await app.close();
  });

  async function createSet(visibility: SetVisibility, title: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/flashcard-sets')
      .set('Cookie', ownerCookies)
      .send({ title, visibility });
    expect(response.status).toBe(201);
    createdSetIds.push(response.body.data.id);
    return response.body.data.id as string;
  }

  it('serves Explore results from PostgreSQL instead of failing', async () => {
    const term = `${runId}-search`;
    await createSet(SetVisibility.PUBLIC, `${term} Set`);

    const response = await request(app.getHttpServer())
      .get(`/search?q=${encodeURIComponent(term)}`)
      .set('Cookie', ownerCookies);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].title).toBe(`${term} Set`);
  });

  it('still returns complete, enriched results — no field is lost with the cache', async () => {
    const term = `${runId}-enriched`;
    const setId = await createSet(SetVisibility.PUBLIC, `${term} Set`);
    await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies).expect(201);

    const response = await request(app.getHttpServer())
      .get(`/search?q=${encodeURIComponent(term)}`)
      .set('Cookie', ownerCookies);

    expect(response.body.data.items[0]).toMatchObject({
      likeCount: 1,
      commentCount: 0,
      likedByCurrentUser: true,
    });
    expect(response.body.data.items[0].creator.displayName).toBe('Degraded Test User');
  });

  it('still enforces visibility with no cache to consult', async () => {
    const term = `${runId}-visibility`;
    await createSet(SetVisibility.PRIVATE, `${term} Private`);
    await createSet(SetVisibility.UNLISTED, `${term} Unlisted`);

    const response = await request(app.getHttpServer())
      .get(`/search?q=${encodeURIComponent(term)}`)
      .set('Cookie', ownerCookies);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
  });

  // Invalidation runs after the commit; a failing sweep must not turn a
  // successful write into a 500.
  it('completes mutations even though every invalidation attempt fails', async () => {
    const setId = await createSet(SetVisibility.PUBLIC, `${runId}-mutation Set`);

    await request(app.getHttpServer())
      .patch(`/flashcard-sets/${setId}`)
      .set('Cookie', ownerCookies)
      .send({ visibility: SetVisibility.PRIVATE })
      .expect(200);

    const stored = await setsRepo.findOne({ where: { id: setId } });
    expect(stored!.visibility).toBe(SetVisibility.PRIVATE);
  });

  it('keeps authentication working — Redis is not in the auth path at all', async () => {
    await request(app.getHttpServer()).get('/search').expect(401);

    const me = await request(app.getHttpServer()).get('/users/me').set('Cookie', ownerCookies);
    expect(me.status).toBe(200);
  });
});
