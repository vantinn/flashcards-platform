import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash: string | null;
  googleId?: string | null;
  emailVerifiedAt?: Date | null;
}

export interface UpdateUserInput {
  displayName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ googleId });
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create(input);
    return this.usersRepository.save(user);
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    Object.assign(user, input);
    return this.usersRepository.save(user);
  }

  /** Updates the name/password on a not-yet-verified account when the same email re-registers instead of creating a duplicate row. */
  async updatePendingRegistration(id: string, input: { displayName: string; passwordHash: string }): Promise<User> {
    await this.usersRepository.update(id, input);
    return (await this.findById(id))!;
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.usersRepository.update(id, { emailVerifiedAt: new Date() });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(id, { passwordHash });
  }

  /** Invalidates every refresh token issued before this call — see AuthService.refresh(). */
  async incrementTokenVersion(id: string): Promise<void> {
    await this.usersRepository.increment({ id }, 'tokenVersion', 1);
  }

  /** Links a Google identity to an existing email match, or creates a new user. */
  async findOrCreateByGoogleProfile(profile: {
    googleId: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  }): Promise<User> {
    const byGoogleId = await this.findByGoogleId(profile.googleId);
    if (byGoogleId) {
      return byGoogleId;
    }

    const byEmail = await this.findByEmail(profile.email);
    if (byEmail) {
      byEmail.googleId = profile.googleId;
      // Linking Google to a pending (unverified) password account counts
      // as verifying it — Google has already confirmed this address.
      byEmail.emailVerifiedAt ??= new Date();
      return this.usersRepository.save(byEmail);
    }

    return this.create({
      email: profile.email,
      displayName: profile.displayName,
      passwordHash: null,
      googleId: profile.googleId,
      // Google has already verified this address — no OTP step needed.
      emailVerifiedAt: new Date(),
    });
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}
