import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Gender } from './entities/user.entity.js';
import type { OnboardingDto } from './dto/onboarding.dto.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  gender: Gender | null;
  onboardingCompleted: boolean;
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

  /**
   * Saves the required onboarding gender and, optionally, one of the two
   * fixed onboarding avatars — stored as a root-relative path
   * (`/avatars/1.png`) so it renders exactly like any other avatarUrl with
   * no frontend-side resolution step, and with no production domain baked
   * in. An omitted avatar leaves the existing avatarUrl (default-avatar
   * behavior included) untouched entirely.
   *
   * Marks onboarding complete as soon as gender is saved — avatar is
   * optional and must never be required for completion (see
   * onboardingCompletedAt on the entity). Safe to call again later (e.g. the
   * user revisits the avatar choice): re-saves gender/avatar without
   * resetting the original completion time.
   */
  async completeOnboarding(id: string, dto: OnboardingDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.gender = dto.gender;
    if (dto.avatar) {
      user.avatarUrl = `/avatars/${dto.avatar}`;
    }
    user.onboardingCompletedAt ??= new Date();

    return this.usersRepository.save(user);
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
      gender: user.gender,
      onboardingCompleted: user.onboardingCompletedAt !== null,
    };
  }
}
