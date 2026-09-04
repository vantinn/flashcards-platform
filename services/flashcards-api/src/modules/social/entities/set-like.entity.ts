import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { FlashcardSet } from '../../flashcard-sets/entities/flashcard-set.entity.js';

/**
 * One row per (user, set) like. The unique constraint below — not
 * application-level "check then insert" — is what actually prevents a
 * double-click, two open tabs, or a retried request from creating a
 * duplicate: LikesService.like() relies on it via an insert-or-ignore.
 */
@Entity('set_likes')
@Unique(['user', 'flashcardSet'])
export class SetLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Index()
  @ManyToOne(() => FlashcardSet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flashcard_set_id' })
  flashcardSet: Relation<FlashcardSet>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
