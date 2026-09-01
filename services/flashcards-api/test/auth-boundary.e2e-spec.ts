import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

/**
 * The global JwtAuthGuard (APP_GUARD) is the real security boundary for the
 * whole product — these hit real HTTP routes on a real Nest app instance
 * (not mocked providers) specifically to prove the guard actually runs
 * before any controller/service logic, for every route that isn't
 * explicitly @Public(). A random, non-existent UUID is used throughout: if
 * auth is enforced first, the response is 401 regardless of whether the
 * resource exists — a 404 here would mean the guard was bypassed.
 */
describe('Authentication boundary (e2e)', () => {
  let app: INestApplication<App>;
  const randomId = '00000000-0000-0000-0000-000000000000';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const protectedRoutes: [string, string][] = [
    ['GET', '/flashcard-sets'],
    ['POST', '/flashcard-sets'],
    [`GET`, `/flashcard-sets/${randomId}`],
    ['PATCH', `/flashcard-sets/${randomId}`],
    ['DELETE', `/flashcard-sets/${randomId}`],
    ['POST', `/flashcard-sets/${randomId}/duplicate`],
    ['GET', `/flashcard-sets/${randomId}/cards`],
    ['POST', `/flashcard-sets/${randomId}/cards`],
    ['PATCH', `/flashcard-sets/${randomId}/cards/reorder`],
    ['PATCH', `/flashcards/${randomId}`],
    ['DELETE', `/flashcards/${randomId}`],
    ['GET', '/search'],
    ['POST', '/study-sessions'],
    ['GET', '/study-sessions'],
    ['GET', '/study-sessions/stats'],
    [`POST`, `/study-sessions/${randomId}/complete`],
    ['POST', '/learning-sessions/start'],
    ['GET', '/learning-sessions'],
    [`GET`, `/learning-sessions/${randomId}`],
    [`GET`, `/learning-sessions/${randomId}/question`],
    [`POST`, `/learning-sessions/${randomId}/answer`],
    ['GET', '/progress/me'],
    ['GET', '/progress/summary'],
    ['GET', '/users/me'],
  ];

  it.each(protectedRoutes)('%s %s rejects an unauthenticated caller with 401', async (method, path) => {
    const response = await request(app.getHttpServer())
      [method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](path)
      .send({});
    expect(response.status).toBe(401);
  });

  it('does not gate auth-flow routes behind the JWT guard (they fail for their own reasons, not the guard)', async () => {
    // Wrong credentials still reach AuthService and get its specific message
    // ("Invalid email or password") — a bug that made the guard fire on this
    // @Public() route instead would produce passport's generic 401 shape
    // with no such message, since the request would never reach the
    // controller/service at all.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });
    expect(login.status).toBe(401);
    expect(login.body.message).toBe('Invalid email or password');
  });

  it('/health stays public with no application data', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ data: { status: 'ok', service: 'flashcards-api' } });
  });
});
