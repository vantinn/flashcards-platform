import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from './users.service.js';
import { User, Gender } from './entities/user.entity.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: null,
    displayName: 'Test User',
    avatarUrl: null,
    gender: null,
    onboardingCompletedAt: null,
    googleId: null,
    emailVerifiedAt: new Date(),
    tokenVersion: 0,
    sets: [],
    studySessions: [],
    studyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOneBy: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repo = {
      findOneBy: vi.fn(),
      save: vi.fn((entity) => Promise.resolve(entity)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('toPublic', () => {
    it('derives onboardingCompleted from onboardingCompletedAt rather than exposing the raw timestamp', () => {
      const complete = buildUser({ onboardingCompletedAt: new Date() });
      const incomplete = buildUser({ onboardingCompletedAt: null });

      expect(service.toPublic(complete).onboardingCompleted).toBe(true);
      expect(service.toPublic(incomplete).onboardingCompleted).toBe(false);
      expect(service.toPublic(complete)).not.toHaveProperty('onboardingCompletedAt');
    });

    it('includes gender as-is', () => {
      expect(service.toPublic(buildUser({ gender: Gender.FEMALE })).gender).toBe(Gender.FEMALE);
      expect(service.toPublic(buildUser({ gender: null })).gender).toBeNull();
    });
  });

  describe('completeOnboarding', () => {
    it('throws NotFoundException for a non-existent user', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.completeOnboarding('missing', { gender: Gender.MALE })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('saves gender and marks onboarding complete, with no avatar given', async () => {
      const user = buildUser();
      repo.findOneBy.mockResolvedValue(user);

      const result = await service.completeOnboarding(user.id, { gender: Gender.MALE });

      expect(result.gender).toBe(Gender.MALE);
      expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
      expect(result.avatarUrl).toBeNull();
    });

    it('resolves an allowed avatar identifier to a root-relative static path, never a full URL', async () => {
      const user = buildUser();
      repo.findOneBy.mockResolvedValue(user);

      const result = await service.completeOnboarding(user.id, { gender: Gender.FEMALE, avatar: '2.png' });

      expect(result.avatarUrl).toBe('/avatars/2.png');
    });

    it('leaves an existing avatarUrl (default-avatar behavior) untouched when no avatar is given', async () => {
      const user = buildUser({ avatarUrl: null });
      repo.findOneBy.mockResolvedValue(user);

      const result = await service.completeOnboarding(user.id, { gender: Gender.MALE });

      expect(result.avatarUrl).toBeNull();
    });

    it('does not require avatar for onboarding to complete', async () => {
      const user = buildUser();
      repo.findOneBy.mockResolvedValue(user);

      const result = await service.completeOnboarding(user.id, { gender: Gender.MALE });

      expect(result.onboardingCompletedAt).not.toBeNull();
      expect(result.avatarUrl).toBeNull();
    });

    it('does not reset the original completion time on a later call', async () => {
      const firstCompletedAt = new Date('2026-01-01T00:00:00Z');
      const user = buildUser({ gender: Gender.MALE, onboardingCompletedAt: firstCompletedAt });
      repo.findOneBy.mockResolvedValue(user);

      const result = await service.completeOnboarding(user.id, { gender: Gender.FEMALE, avatar: '1.png' });

      expect(result.gender).toBe(Gender.FEMALE);
      expect(result.onboardingCompletedAt).toBe(firstCompletedAt);
    });
  });
});
