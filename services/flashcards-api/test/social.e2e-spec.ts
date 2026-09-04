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
import { SetLike } from '../src/modules/social/entities/set-like.entity.js';
import { Comment } from '../src/modules/social/entities/comment.entity.js';

const PASSWORD = 'password123';

/**
 * Real HTTP + real Postgres, same approach as auth-boundary/users-onboarding
 * e2e specs. Each of the three test users is created and logged in exactly
 * once in beforeAll (not per test) — /auth/login's own rate limit is 10/min,
 * and reusing one session per user across many `it()` blocks keeps this file
 * well under that regardless of how many cases it covers.
 */
describe('Social interactions: likes, comments, replies (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let setsRepo: Repository<FlashcardSet>;
  let likesRepo: Repository<SetLike>;
  let commentsRepo: Repository<Comment>;
  const createdEmails: string[] = [];
  const createdSetIds: string[] = [];

  let ownerCookies: string[];
  let ownerId: string;
  let nonOwnerCookies: string[];
  let thirdCookies: string[];

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
    likesRepo = moduleFixture.get(getRepositoryToken(SetLike));
    commentsRepo = moduleFixture.get(getRepositoryToken(Comment));

    const owner = await createVerifiedUser('social-owner');
    const nonOwner = await createVerifiedUser('social-nonowner');
    const third = await createVerifiedUser('social-third');

    ownerId = owner.user.id;

    ownerCookies = await loginCookies(owner.email);
    nonOwnerCookies = await loginCookies(nonOwner.email);
    thirdCookies = await loginCookies(third.email);
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
      usersRepo.create({ email, displayName: 'Social Test User', passwordHash, emailVerifiedAt: new Date() }),
    );
    return { email, user };
  }

  async function loginCookies(email: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response.get('Set-Cookie') as string[];
  }

  async function createSet(cookies: string[], visibility: SetVisibility, title = 'Test Set'): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/flashcard-sets')
      .set('Cookie', cookies)
      .send({ title, visibility });
    expect(response.status).toBe(201);
    createdSetIds.push(response.body.data.id);
    return response.body.data.id as string;
  }

  // ── Public-only enforcement + basic like/comment/reply, all owner-created ──

  it('owner can like, comment, and see a non-owner like/comment/reply on their own public set', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Public Set A');

    // Owner likes their own set.
    const ownerLike = await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies);
    expect(ownerLike.status).toBe(201);
    expect(ownerLike.body.data).toEqual({ liked: true, likeCount: 1 });

    // Owner comments on their own set.
    const ownerComment = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', ownerCookies)
      .send({ content: 'My own set is great' });
    expect(ownerComment.status).toBe(201);

    // A non-owner can like the same public set.
    const nonOwnerLike = await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', nonOwnerCookies);
    expect(nonOwnerLike.status).toBe(201);
    expect(nonOwnerLike.body.data).toEqual({ liked: true, likeCount: 2 });

    // A non-owner can comment.
    const nonOwnerComment = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'Great set, thanks!' });
    expect(nonOwnerComment.status).toBe(201);

    // A non-owner can reply to the owner's top-level comment.
    const reply = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments/${ownerComment.body.data.id}/replies`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'Agreed!' });
    expect(reply.status).toBe(201);

    // Social summary reflects both likes and both comments (top-level x2 + 1 reply = 3).
    const summary = await request(app.getHttpServer()).get(`/flashcard-sets/${setId}/social`).set('Cookie', ownerCookies);
    expect(summary.body.data).toEqual({ likeCount: 2, commentCount: 3, likedByCurrentUser: true });

    // The list endpoint returns the 2 top-level comments, newest first, with reply count on the owner's.
    const list = await request(app.getHttpServer()).get(`/flashcard-sets/${setId}/comments`).set('Cookie', ownerCookies);
    expect(list.body.data.items).toHaveLength(2);
    const ownerCommentInList = list.body.data.items.find((c: { id: string }) => c.id === ownerComment.body.data.id);
    expect(ownerCommentInList.replyCount).toBe(1);
    expect(ownerCommentInList.author).toEqual({ id: ownerId, displayName: 'Social Test User', avatarUrl: null });
  });

  it('duplicate like requests never create more than one row, and unlike is idempotent', async () => {
    const setId = await createSet(nonOwnerCookies, SetVisibility.PUBLIC, 'Duplicate Like Set');

    // Fire two concurrent like requests for the same user.
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies),
      request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies),
    ]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.data.likeCount).toBe(1);
    expect(second.body.data.likeCount).toBe(1);

    const rowCount = await likesRepo.count({ where: { flashcardSet: { id: setId }, user: { id: ownerId } } });
    expect(rowCount).toBe(1);

    // Unliking twice is a safe no-op, not an error.
    const unlike1 = await request(app.getHttpServer()).delete(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies);
    const unlike2 = await request(app.getHttpServer()).delete(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies);
    expect(unlike1.status).toBe(200);
    expect(unlike2.status).toBe(200);
    expect(unlike2.body.data).toEqual({ liked: false, likeCount: 0 });
  });

  it('rejects Like/Comment/Reply on a PRIVATE set, including for its own owner', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PRIVATE, 'Private Set');

    // The owner themselves cannot like/comment on their own private set —
    // PRIVATE means no social interaction at all, ownership included.
    const ownerLike = await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies);
    expect(ownerLike.status).toBe(403);
    const ownerComment = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', ownerCookies)
      .send({ content: 'x' });
    expect(ownerComment.status).toBe(403);

    // A non-owner can't even see the set (private + not theirs) — 404, not 403.
    const nonOwnerLike = await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', nonOwnerCookies);
    expect(nonOwnerLike.status).toBe(404);
  });

  it('rejects Like/Comment on an UNLISTED set — visibility must be exactly PUBLIC, not "reachable"', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.UNLISTED, 'Unlisted Set');

    // Unlisted sets are viewable by anyone (unlike private), but social
    // interaction still requires visibility === PUBLIC specifically.
    const like = await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', nonOwnerCookies);
    expect(like.status).toBe(403);

    const comment = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'x' });
    expect(comment.status).toBe(403);

    const summary = await request(app.getHttpServer()).get(`/flashcard-sets/${setId}/social`).set('Cookie', nonOwnerCookies);
    expect(summary.status).toBe(403);
  });

  // ── Content validation ──

  it('rejects empty/whitespace-only comments and comments over the max length, with a clear validation error', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Validation Set');

    const empty = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', ownerCookies)
      .send({ content: '   ' });
    expect(empty.status).toBe(400);

    const tooLong = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', ownerCookies)
      .send({ content: 'a'.repeat(2001) });
    expect(tooLong.status).toBe(400);

    // Leading/trailing whitespace is trimmed, not silently truncated.
    const padded = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', ownerCookies)
      .send({ content: '  hello world  ' });
    expect(padded.status).toBe(201);
    expect(padded.body.data.content).toBe('hello world');
  });

  // ── Cross-set injection + one-level-reply enforcement ──

  it('rejects a reply whose parentCommentId belongs to a different flashcard set', async () => {
    const setA = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Set A');
    const setB = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Set B');

    const commentOnA = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setA}/comments`)
      .set('Cookie', ownerCookies)
      .send({ content: 'comment on A' });

    // Claiming setB's URL while pointing at a comment that actually lives on A.
    const crossSetReply = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setB}/comments/${commentOnA.body.data.id}/replies`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'sneaky' });
    expect(crossSetReply.status).toBe(400);
  });

  it('rejects replying to a reply — V1 supports exactly one level of nesting', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, 'One Level Set');
    const topLevel = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', ownerCookies)
      .send({ content: 'top level' });
    const reply = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments/${topLevel.body.data.id}/replies`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'a reply' });
    expect(reply.status).toBe(201);

    const nestedReply = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments/${reply.body.data.id}/replies`)
      .set('Cookie', thirdCookies)
      .send({ content: 'reply to a reply' });
    expect(nestedReply.status).toBe(400);
  });

  // ── Edit/delete authorization ──

  it('lets the author edit/delete their own comment, blocks other non-owning users, and lets the set owner moderate', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Moderation Set');
    const comment = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'original' });
    const commentId = comment.body.data.id;

    // Another (unrelated, non-owning) user cannot edit it.
    const badEdit = await request(app.getHttpServer())
      .patch(`/comments/${commentId}`)
      .set('Cookie', thirdCookies)
      .send({ content: 'hijacked' });
    expect(badEdit.status).toBe(403);

    // The author can edit their own comment.
    const goodEdit = await request(app.getHttpServer())
      .patch(`/comments/${commentId}`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'edited by author' });
    expect(goodEdit.status).toBe(200);
    expect(goodEdit.body.data.content).toBe('edited by author');

    // An unrelated user (not the author, not the set owner) cannot delete it.
    const badDelete = await request(app.getHttpServer()).delete(`/comments/${commentId}`).set('Cookie', thirdCookies);
    expect(badDelete.status).toBe(403);

    // The set owner CAN delete it for moderation, even though they didn't write it.
    const moderate = await request(app.getHttpServer()).delete(`/comments/${commentId}`).set('Cookie', ownerCookies);
    expect(moderate.status).toBe(204);

    const stillThere = await commentsRepo.findOneBy({ id: commentId });
    expect(stillThere).toBeNull();
  });

  it('a set owner cannot moderate a comment on someone else\'s set', async () => {
    const setId = await createSet(nonOwnerCookies, SetVisibility.PUBLIC, 'Not Owner\'s Set');
    const comment = await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', thirdCookies)
      .send({ content: 'third user comment' });

    // ownerCookies belongs to a user who owns a *different* set, not this one.
    const response = await request(app.getHttpServer()).delete(`/comments/${comment.body.data.id}`).set('Cookie', ownerCookies);
    expect(response.status).toBe(403);
  });

  // ── Visibility flips ──

  it('PUBLIC -> PRIVATE blocks interaction and hides the social API; PRIVATE -> PUBLIC restores it with prior data intact', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Flip Set');
    await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', nonOwnerCookies);
    await request(app.getHttpServer())
      .post(`/flashcard-sets/${setId}/comments`)
      .set('Cookie', nonOwnerCookies)
      .send({ content: 'before the flip' });

    await request(app.getHttpServer())
      .patch(`/flashcard-sets/${setId}`)
      .set('Cookie', ownerCookies)
      .send({ visibility: SetVisibility.PRIVATE });

    const blockedSummary = await request(app.getHttpServer()).get(`/flashcard-sets/${setId}/social`).set('Cookie', ownerCookies);
    expect(blockedSummary.status).toBe(403);
    const blockedLike = await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', ownerCookies);
    expect(blockedLike.status).toBe(403);

    // The underlying rows are still there — visibility gates access, it doesn't delete data.
    const likeRowCount = await likesRepo.count({ where: { flashcardSet: { id: setId } } });
    expect(likeRowCount).toBe(1);

    await request(app.getHttpServer())
      .patch(`/flashcard-sets/${setId}`)
      .set('Cookie', ownerCookies)
      .send({ visibility: SetVisibility.PUBLIC });

    const restoredSummary = await request(app.getHttpServer()).get(`/flashcard-sets/${setId}/social`).set('Cookie', ownerCookies);
    expect(restoredSummary.status).toBe(200);
    expect(restoredSummary.body.data).toMatchObject({ likeCount: 1, commentCount: 1 });
  });

  // ── Privacy: owner email is never leaked ──

  it('never exposes the owner\'s email through the set-detail or Explore/search responses', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Privacy Set');
    const owner = await usersRepo.findOneBy({ id: ownerId });

    const detail = await request(app.getHttpServer()).get(`/flashcard-sets/${setId}`).set('Cookie', nonOwnerCookies);
    expect(JSON.stringify(detail.body)).not.toContain(owner!.email);
    expect(detail.body.data.creator.displayName).toBeDefined();

    const search = await request(app.getHttpServer())
      .get(`/search?q=${encodeURIComponent('Privacy Set')}`)
      .set('Cookie', nonOwnerCookies);
    expect(JSON.stringify(search.body)).not.toContain(owner!.email);
  });

  // ── Explore/search enrichment ──

  it('Explore/search results include owner avatar/name, like/comment counts, and likedByCurrentUser', async () => {
    const setId = await createSet(ownerCookies, SetVisibility.PUBLIC, 'Explore Enrichment Set');
    await request(app.getHttpServer()).post(`/flashcard-sets/${setId}/likes`).set('Cookie', nonOwnerCookies);

    const search = await request(app.getHttpServer())
      .get(`/search?q=${encodeURIComponent('Explore Enrichment Set')}`)
      .set('Cookie', nonOwnerCookies);
    const found = search.body.data.items.find((s: { id: string }) => s.id === setId);

    expect(found).toBeDefined();
    expect(found.creator).toEqual({ id: ownerId, displayName: 'Social Test User', avatarUrl: null });
    expect(found.likeCount).toBe(1);
    expect(found.likedByCurrentUser).toBe(true);

    // A different viewer, who hasn't liked it, sees likedByCurrentUser: false for the same set.
    const searchAsThird = await request(app.getHttpServer())
      .get(`/search?q=${encodeURIComponent('Explore Enrichment Set')}`)
      .set('Cookie', thirdCookies);
    const foundForThird = searchAsThird.body.data.items.find((s: { id: string }) => s.id === setId);
    expect(foundForThird.likedByCurrentUser).toBe(false);
    expect(foundForThird.likeCount).toBe(1); // the count itself is shared, not per-viewer
  });
});
