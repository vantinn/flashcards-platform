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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  // Excluded for the same reason as passwordHash: this entity is returned
  // directly (via nested `creator` relations on flashcard-sets endpoints,
  // some of which are publicly readable) rather than always going through
  // UsersService.toPublic() first. Without this, any visitor viewing a
  // public set could see whether its creator has Google sign-in linked.
  @Exclude()
  @Column({ name: 'google_id', type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

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
