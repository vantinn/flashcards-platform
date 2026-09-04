import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { FlashcardSet } from '../../flashcard-sets/entities/flashcard-set.entity.js';
import { StudySession } from '../../study/entities/study-session.entity.js';
import { StudyProgress } from '../../progress/entities/study-progress.entity.js';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Excluded from automatic entity serialization for the same reason as
  // passwordHash/googleId below: this entity is returned directly (nested
  // as `creator` on flashcard-sets endpoints, some of which are visible to
  // any signed-in user — e.g. Explore, a public set's detail page) rather
  // than always going through UsersService.toPublic() first. `/users/me`,
  // login, register, etc. are unaffected — they all build their response
  // from toPublic()'s plain object, which explicitly includes email and
  // isn't subject to this class-level annotation.
  @Exclude()
  @Column({ type: 'varchar', unique: true })
  email: string;

  // Never serialized in API responses (see ClassSerializerInterceptor in
  // main.ts) — this previously leaked in nested `creator` relations.
  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'display_name', type: 'varchar' })
  displayName: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  // Set during onboarding (required step 1). Nullable because pre-existing
  // accounts (from before onboarding existed) and not-yet-onboarded new
  // accounts both have no value here — see onboardingCompletedAt below for
  // how those two cases are told apart.
  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  // Onboarding's completion marker — set once the required gender step is
  // saved (see UsersService.completeOnboarding). Deliberately a nullable
  // timestamp rather than a plain boolean, matching emailVerifiedAt's
  // pattern below. The AddUserOnboarding migration backfills this for every
  // account that existed before onboarding shipped, so only genuinely new
  // signups (created after that migration ran) start null and get routed
  // through the onboarding flow. Excluded from serialization — toPublic()
  // exposes a derived `onboardingCompleted` boolean instead of this raw
  // timestamp.
  @Exclude()
  @Column({ name: 'onboarding_completed_at', type: 'timestamptz', nullable: true })
  onboardingCompletedAt: Date | null;

  // Excluded for the same reason as passwordHash: this entity is returned
  // directly (via nested `creator` relations on flashcard-sets endpoints,
  // some of which are publicly readable) rather than always going through
  // UsersService.toPublic() first. Without this, any visitor viewing a
  // public set could see whether its creator has Google sign-in linked.
  @Exclude()
  @Column({ name: 'google_id', type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  // Null means "registered with a password but hasn't confirmed the OTP
  // yet" — login() rejects password-based sign-in until this is set.
  // Google sign-in sets it at creation time since Google already verified
  // that address. Excluded from serialization for the same reason as
  // googleId — not part of the PublicUser contract.
  @Exclude()
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // Bumped on password reset so AuthService.refresh() can reject refresh
  // tokens minted before the reset — see auth.service.ts issueTokens/refresh.
  @Exclude()
  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;

  @OneToMany(() => FlashcardSet, (set) => set.creator)
  sets: Relation<FlashcardSet>[];

  @OneToMany(() => StudySession, (session) => session.user)
  studySessions: Relation<StudySession>[];

  @OneToMany(() => StudyProgress, (progress) => progress.user)
  studyProgress: Relation<StudyProgress>[];

  // Explicit timestamptz — TypeORM's default for these decorators on
  // Postgres is a timezone-naive `timestamp`, which node-postgres parses
  // back as local server time rather than UTC. On any server not running
  // in UTC that silently corrupts every date by the server's UTC offset.
  //
  // Also excluded from serialization for the same reason as googleId above
  // — these aren't part of the PublicUser contract (id/email/displayName/
  // avatarUrl) that every client's types.ts agrees on, so a nested
  // `creator` shouldn't expose a user's exact account-creation timestamp.
  @Exclude()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Exclude()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
