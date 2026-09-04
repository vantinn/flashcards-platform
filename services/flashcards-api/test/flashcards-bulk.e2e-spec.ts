import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { FlashcardSet, SetVisibility } from '../src/modules/flashcard-sets/entities/flashcard-set.entity.js';
import { Flashcard } from '../src/modules/flashcards/entities/flashcard.entity.js';

const PASSWORD = 'password123';

/**
 * Real HTTP + real Postgres, same approach as the other e2e specs in this
 * project (see social.e2e-spec.ts / users-onboarding.e2e-spec.ts) — each
 * test user is created and logged in exactly once in beforeAll and reused
 * across every `it()` below, since /auth/login has its own 10/min rate
 * limit and this file has many small, focused cases.
 */
describe('POST /flashcard-sets/:setId/cards/bulk (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let setsRepo: Repository<FlashcardSet>;
  let cardsRepo: Repository<Flashcard>;
  const createdEmails: string[] = [];
  const createdSetIds: string[] = [];

  let ownerCookies: string[];
  let otherUserCookies: string[];

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
    cardsRepo = moduleFixture.get(getRepositoryToken(Flashcard));

    const owner = await createVerifiedUser('bulk-owner');
    const other = await createVerifiedUser('bulk-other');
    ownerCookies = await loginCookies(owner.email);
    otherUserCookies = await loginCookies(other.email);
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

  async function createVerifiedUser(emailPrefix: string) {
    const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdEmails.push(email);
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const user = await usersRepo.save(
      usersRepo.create({ email, displayName: 'Bulk Test User', passwordHash, emailVerifiedAt: new Date() }),
    );
    return { email, user };
  }

  async function loginCookies(email: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response.get('Set-Cookie') as string[];
  }

  async function createSet(visibility: SetVisibility = SetVisibility.PRIVATE): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/flashcard-sets')
      .set('Cookie', ownerCookies)
      .send({ title: 'Bulk Import Test Set', visibility });
    expect(response.status).toBe(201);
    createdSetIds.push(response.body.data.id);
    return response.body.data.id as string;
  }

  function bulk(setId: string, cookies: string[], cards: unknown) {
    return request(app.getHttpServer()).post(`/flashcard-sets/${setId}/cards/bulk`).set('Cookie', cookies).send({ cards });
  }

  it('lets the authenticated owner bulk-create cards', async () => {
    const setId = await createSet();

    const response = await bulk(setId, ownerCookies, [
      { front: 'hello', back: 'xin chào' },
      { front: 'world', back: 'thế giới' },
    ]);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ importedCount: 2, duplicateCount: 0, totalReceived: 2 });
    expect(response.body.data.cards).toHaveLength(2);

    const cardsInSet = await cardsRepo.find({ where: { set: { id: setId } } });
    expect(cardsInSet).toHaveLength(2);
  });

  it('rejects a user who does not own the set', async () => {
    const setId = await createSet(SetVisibility.PUBLIC);

    const response = await bulk(setId, otherUserCookies, [{ front: 'a', back: 'b' }]);

    expect(response.status).toBe(403);
    expect(await cardsRepo.count({ where: { set: { id: setId } } })).toBe(0);
  });

  it('rejects a user who can only study a PUBLIC set they do not own — visibility never implies edit permission', async () => {
    const setId = await createSet(SetVisibility.PUBLIC);

    // Confirm the other user really can view/study this set first (so the
    // 403 below is specifically about edit permission, not visibility).
    const viewResponse = await request(app.getHttpServer()).get(`/flashcard-sets/${setId}`).set('Cookie', otherUserCookies);
    expect(viewResponse.status).toBe(200);

    const response = await bulk(setId, otherUserCookies, [{ front: 'a', back: 'b' }]);
    expect(response.status).toBe(403);
  });

  it('rejects a request from someone who cannot even see a PRIVATE set — 404, not 403', async () => {
    const setId = await createSet(SetVisibility.PRIVATE);

    const response = await bulk(setId, otherUserCookies, [{ front: 'a', back: 'b' }]);
    expect(response.status).toBe(404);
  });

  it('rejects an empty cards array', async () => {
    const setId = await createSet();
    const response = await bulk(setId, ownerCookies, []);
    expect(response.status).toBe(400);
  });

  it('rejects a payload with more cards than MAX_BULK_FLASHCARDS allows', async () => {
    const setId = await createSet();
    // The .env.example / config default is 500 — well below the DTO's own
    // 1000-item hard ceiling, so this genuinely exercises the configurable
    // service-level limit, not just the DTO backstop.
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ front: `front-${i}`, back: `back-${i}` }));

    const response = await bulk(setId, ownerCookies, tooMany);

    expect(response.status).toBe(400);
    expect(await cardsRepo.count({ where: { set: { id: setId } } })).toBe(0);
  });

  it('rejects a row missing front or back with a validation error, and imports nothing from that request', async () => {
    const setId = await createSet();

    const response = await bulk(setId, ownerCookies, [{ front: 'hello' }]);

    expect(response.status).toBe(400);
    expect(await cardsRepo.count({ where: { set: { id: setId } } })).toBe(0);
  });

  it('rejects a client-supplied position/setId/userId on a row — only front/back are accepted', async () => {
    const setId = await createSet();

    const response = await bulk(setId, ownerCookies, [
      { front: 'hello', back: 'xin chào', position: 999, setId: 'other-set', userId: 'someone-else' },
    ]);

    expect(response.status).toBe(400);
  });

  it('detects duplicates within the pasted batch and against existing cards, importing only the rest', async () => {
    const setId = await createSet();
    await bulk(setId, ownerCookies, [{ front: 'existing', back: 'card' }]);

    const response = await bulk(setId, ownerCookies, [
      { front: 'existing', back: 'card' }, // duplicates an existing card
      { front: 'new', back: 'card' },
      { front: 'new', back: 'card' }, // duplicates the row above, within this same batch
      { front: 'another', back: 'one' },
    ]);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ totalReceived: 4, importedCount: 2, duplicateCount: 2 });

    const cardsInSet = await cardsRepo.find({ where: { set: { id: setId } } });
    expect(cardsInSet).toHaveLength(3); // 1 pre-existing + 2 newly imported
  });

  it('assigns sequential, deterministic positions continuing after any existing cards, preserving paste order', async () => {
    const setId = await createSet();
    await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/cards`)
      .set('Cookie', ownerCookies)
      .send({ front: 'first card', back: 'added manually' });

    const response = await bulk(setId, ownerCookies, [
      { front: 'second', back: 'b' },
      { front: 'third', back: 'c' },
      { front: 'fourth', back: 'd' },
    ]);

    const positions = response.body.data.cards.map((c: { position: number }) => c.position);
    expect(positions).toEqual([1, 2, 3]);

    const allCards = await cardsRepo.find({ where: { set: { id: setId } }, order: { position: 'ASC' } });
    expect(allCards.map((c) => c.front)).toEqual(['first card', 'second', 'third', 'fourth']);
  });

  it('imports cards that belong to the requested set, never a different one', async () => {
    const setA = await createSet();
    const setB = await createSet();

    await bulk(setA, ownerCookies, [{ front: 'belongs to A', back: 'x' }]);

    const cardsInA = await cardsRepo.find({ where: { set: { id: setA } } });
    const cardsInB = await cardsRepo.find({ where: { set: { id: setB } } });
    expect(cardsInA).toHaveLength(1);
    expect(cardsInB).toHaveLength(0);
  });

  it('increments the set\'s cardCount by exactly the number of cards actually imported (not the number received)', async () => {
    const setId = await createSet();
    await bulk(setId, ownerCookies, [{ front: 'a', back: 'b' }]);

    // Second request: 1 duplicate of the above + 1 genuinely new card.
    await bulk(setId, ownerCookies, [
      { front: 'a', back: 'b' },
      { front: 'c', back: 'd' },
    ]);

    const set = await setsRepo.findOneBy({ id: setId });
    expect(set?.cardCount).toBe(2);
  });

  it('imported cards work like any normal card — reusing the same entity, not a special bulk-only type', async () => {
    const setId = await createSet();
    const bulkResponse = await bulk(setId, ownerCookies, [{ front: 'hello', back: 'xin chào' }]);
    const cardId = bulkResponse.body.data.cards[0].id;

    // If it were a "special" bulk card, normal single-card endpoints
    // (update/delete) might not recognize it — prove they do.
    const updateResponse = await request(app.getHttpServer())
      .patch(`/flashcards/${cardId}`)
      .set('Cookie', ownerCookies)
      .send({ front: 'hello (edited)' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.front).toBe('hello (edited)');
  });
});
