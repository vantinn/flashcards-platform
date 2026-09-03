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

const PASSWORD = 'password123';

/**
 * Real HTTP + real Postgres (see auth-boundary.e2e-spec.ts for the same
 * approach) — creates already-verified users directly through the
 * repository (bypassing the OTP email step, which needs real Gmail creds)
 * and authenticates through the real /auth/login endpoint to get a real
 * session cookie, then exercises PATCH /users/me/onboarding as an actual
 * caller would.
 *
 * Unlike the other e2e specs, this one needs a full login -> cookie ->
 * authenticated-request round trip, so it also has to apply the same
 * cookie-parser + ValidationPipe setup main.ts's bootstrap() applies to the
 * real app — a bare `Test.createTestingModule` does not pick those up on
 * its own since they're wired imperatively in main.ts, not as part of
 * AppModule's own providers.
 */
describe('PATCH /users/me/onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    usersRepo = moduleFixture.get(getRepositoryToken(User));
  });

  afterAll(async () => {
    for (const email of createdEmails) {
      await usersRepo.delete({ email });
    }
    await app.close();
  });

  async function createVerifiedUser(emailPrefix: string, overrides: Partial<User> = {}) {
    const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdEmails.push(email);
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const user = await usersRepo.save(
      usersRepo.create({
        email,
        displayName: 'Onboarding Test User',
        passwordHash,
        emailVerifiedAt: new Date(),
        ...overrides,
      }),
    );
    return { email, user };
  }

  async function loginCookies(email: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies as string[];
  }

  // Grouped under one login per scenario (rather than one per assertion) to
  // stay well under /auth/login's own rate limit (10/min) — these are still
  // exercising the real HTTP + DB stack, just fewer independent sessions.

  it('rejects a request with no gender, an invalid gender value, and an arbitrary avatar URL', async () => {
    const { email } = await createVerifiedUser('validation');
    const cookies = await loginCookies(email);

    const noGender = await request(app.getHttpServer()).patch('/users/me/onboarding').set('Cookie', cookies).send({});
    expect(noGender.status).toBe(400);

    const badGender = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', cookies)
      .send({ gender: 'other' });
    expect(badGender.status).toBe(400);

    const arbitraryAvatar = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', cookies)
      .send({ gender: 'male', avatar: 'https://some-external-site.com/avatar.png' });
    expect(arbitraryAvatar.status).toBe(400);
  });

  it('accepts avatar 1.png and 2.png, and leaves avatarUrl untouched (not cleared) when a later call omits avatar', async () => {
    const { email } = await createVerifiedUser('avatars');
    const cookies = await loginCookies(email);

    const first = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', cookies)
      .send({ gender: 'male', avatar: '1.png' });
    expect(first.status).toBe(200);
    expect(first.body.data.avatarUrl).toBe('/avatars/1.png');

    const second = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', cookies)
      .send({ gender: 'male', avatar: '2.png' });
    expect(second.status).toBe(200);
    expect(second.body.data.avatarUrl).toBe('/avatars/2.png');

    // Omitting avatar (the "Bỏ qua" path) must never null out or otherwise
    // touch whatever avatarUrl already holds.
    const third = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', cookies)
      .send({ gender: 'male' });
    expect(third.status).toBe(200);
    expect(third.body.data.avatarUrl).toBe('/avatars/2.png');
  });

  it('completes onboarding with gender and no avatar, and GET /users/me reflects it — avatar is never required', async () => {
    const { email, user } = await createVerifiedUser('no-avatar');
    const cookies = await loginCookies(email);

    const response = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', cookies)
      .send({ gender: 'female' });
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(user.id);
    expect(response.body.data.avatarUrl).toBeNull();
    expect(response.body.data.onboardingCompleted).toBe(true);

    const me = await request(app.getHttpServer()).get('/users/me').set('Cookie', cookies);
    expect(me.body.data.onboardingCompleted).toBe(true);
    expect(me.body.data.avatarUrl).toBeNull();
  });

  it('a well-formed request from user A only ever updates user A\'s own row, and a spoofed userId field is rejected outright', async () => {
    const { user: victim } = await createVerifiedUser('victim');
    const { email: attackerEmail, user: attacker } = await createVerifiedUser('attacker');
    const attackerCookies = await loginCookies(attackerEmail);

    // There is no userId (or any ownership-implying field) anywhere in the
    // real DTO — attempting to smuggle one in is rejected outright by
    // forbidNonWhitelisted, before it could ever reach the service.
    const spoofed = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', attackerCookies)
      .send({ gender: 'male', userId: victim.id });
    expect(spoofed.status).toBe(400);

    // A well-formed request from the same session only ever touches the
    // caller's own row — ownership is derived from @CurrentUser(), never
    // from anything in the body.
    const response = await request(app.getHttpServer())
      .patch('/users/me/onboarding')
      .set('Cookie', attackerCookies)
      .send({ gender: 'male' });
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(attacker.id);

    const victimAfter = await usersRepo.findOneBy({ id: victim.id });
    expect(victimAfter?.gender).toBeNull();
    expect(victimAfter?.onboardingCompletedAt).toBeNull();
  });

  it('a user created with no gender and no onboarding call is simply incomplete (never crashes, never auto-completes)', async () => {
    const { email } = await createVerifiedUser('never-onboarded');
    const cookies = await loginCookies(email);

    const me = await request(app.getHttpServer()).get('/users/me').set('Cookie', cookies);
    expect(me.status).toBe(200);
    expect(me.body.data.gender).toBeNull();
    expect(me.body.data.onboardingCompleted).toBe(false);
  });

  it('an account that existed before the onboarding migration is backfilled as already onboarded (AddUserOnboarding migration)', async () => {
    // Directly simulates what that migration did for every pre-existing
    // row: onboarding_completed_at backfilled from created_at, gender left
    // null. A row like this must never be routed back through onboarding.
    const email = `legacy-${Date.now()}@example.com`;
    createdEmails.push(email);
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const createdAt = new Date('2025-01-01T00:00:00Z');
    await usersRepo.save(
      usersRepo.create({
        email,
        displayName: 'Legacy User',
        passwordHash,
        emailVerifiedAt: createdAt,
        onboardingCompletedAt: createdAt,
      }),
    );

    const cookies = await loginCookies(email);
    const me = await request(app.getHttpServer()).get('/users/me').set('Cookie', cookies);

    expect(me.status).toBe(200);
    expect(me.body.data.gender).toBeNull();
    expect(me.body.data.onboardingCompleted).toBe(true);
  });
});
