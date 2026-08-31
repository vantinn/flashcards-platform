import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import type { User } from '../users/entities/user.entity.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: null,
    displayName: 'Test User',
    avatarUrl: null,
    googleId: null,
    sets: [],
    studySessions: [],
    studyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let usersService: { findByEmail: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                'auth.jwtAccessSecret': 'test-access-secret',
                'auth.jwtAccessExpiresIn': '15m',
                'auth.jwtRefreshSecret': 'test-refresh-secret',
                'auth.jwtRefreshExpiresIn': '30d',
              })[key],
          },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  describe('register', () => {
    it('hashes the password and issues a token pair for a new email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const created = buildUser();
      usersService.create.mockResolvedValue(created);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      });

      expect(usersService.create).toHaveBeenCalledOnce();
      const createArg = usersService.create.mock.calls[0][0];
      expect(createArg.passwordHash).not.toBe('password123');
      expect(result.user).toBe(created);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it('rejects a duplicate email', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      await expect(
        authService.register({ email: 'test@example.com', password: 'password123', displayName: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a Google-only account with no password set', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash: null }));

      await expect(
        authService.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects the wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash: await import('bcrypt').then((b) => b.hash('correct-password', 12)) }),
      );

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts the correct password and issues tokens', async () => {
      const bcrypt = await import('bcrypt');
      const user = buildUser({ passwordHash: await bcrypt.hash('correct-password', 12) });
      usersService.findByEmail.mockResolvedValue(user);

      const result = await authService.login({ email: 'test@example.com', password: 'correct-password' });

      expect(result.user).toBe(user);
      expect(result.tokens.accessToken).toBeTruthy();
    });
  });

  describe('refresh', () => {
    it('rejects a token signed with the wrong secret', async () => {
      const forgedToken = jwtService.sign({ sub: 'user-1', email: 'test@example.com' }, { secret: 'not-the-real-secret' });
      await expect(authService.refresh(forgedToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a garbage string that is not a JWT at all', async () => {
      await expect(authService.refresh('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a validly-signed token for a user that no longer exists', async () => {
      const token = jwtService.sign({ sub: 'deleted-user', email: 'gone@example.com' }, { secret: 'test-refresh-secret' });
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a fresh token pair for a validly-signed token whose user still exists', async () => {
      const token = jwtService.sign({ sub: 'user-1', email: 'test@example.com' }, { secret: 'test-refresh-secret' });
      const user = buildUser();
      usersService.findById.mockResolvedValue(user);

      const result = await authService.refresh(token);

      expect(result.user).toBe(user);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });
  });
});
