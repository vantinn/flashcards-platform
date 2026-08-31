import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import type { User } from '../users/entities/user.entity.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './auth.types.js';
import type { GoogleProfile } from './strategies/google.strategy.js';

const PASSWORD_SALT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(this.configService.get<string>('auth.googleClientId'));
  }

  async register(dto: RegisterDto): Promise<{ user: User; tokens: TokenPair }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      displayName: dto.displayName,
      passwordHash,
    });

    return { user, tokens: this.issueTokens(user) };
  }

  async login(dto: LoginDto): Promise<{ user: User; tokens: TokenPair }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      // Never log dto.password — email + the fact that it failed is all
      // that's useful for spotting credential-stuffing/enumeration, and
      // the response is identical either way (see UsersService.toPublic)
      // so this log line doesn't create a side channel the client can see.
      this.logger.warn(`Login failed (no account or no password set): ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      this.logger.warn(`Login failed (wrong password): ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    return { user, tokens: this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<{ user: User; tokens: TokenPair }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      });
    } catch {
      // Never log the token itself — it's a live credential, not just an
      // identifier, for as long as it would otherwise have been valid.
      this.logger.warn('Refresh rejected: invalid or expired token');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      this.logger.warn(`Refresh rejected: token valid but user ${payload.sub} no longer exists`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return { user, tokens: this.issueTokens(user) };
  }

  async loginWithGoogle(profile: GoogleProfile): Promise<{ user: User; tokens: TokenPair }> {
    const user = await this.usersService.findOrCreateByGoogleProfile(profile);
    return { user, tokens: this.issueTokens(user) };
  }

  /**
   * Native mobile sign-in (Android/iOS) gets a Google ID token client-side
   * and sends it here directly — unlike the web flow (GET /auth/google),
   * there's no redirect/consent-screen round trip for a native app to hook
   * into. Verifies the token's signature and audience server-side before
   * trusting any of its claims.
   */
  async loginWithGoogleIdToken(idToken: string): Promise<{ user: User; tokens: TokenPair }> {
    const audience = this.configService.get<string>('auth.googleClientId');
    if (!audience) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let payload: { sub: string; email?: string; name?: string; picture?: string } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      // Never log the idToken itself, same reasoning as the refresh token above.
      this.logger.warn('Google sign-in rejected: token failed verification');
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const user = await this.usersService.findOrCreateByGoogleProfile({
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name ?? payload.email,
      avatarUrl: payload.picture ?? null,
    });
    return { user, tokens: this.issueTokens(user) };
  }

  private issueTokens(user: User): TokenPair {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwtAccessSecret'),
      expiresIn: this.configService.get<string>('auth.jwtAccessExpiresIn') as never,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('auth.jwtRefreshExpiresIn') as never,
    });

    return { accessToken, refreshToken };
  }
}
