import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { FlashcardSet } from '../../flashcard-sets/entities/flashcard-set.entity.js';

/**
 * Self-referencing: parentComment === null is a top-level comment,
 * non-null is a reply to it. V1 supports exactly one level of nesting —
 * CommentsService.reply() enforces that the parent itself has no parent,
 * so a reply can never itself be replied to. onDelete: CASCADE on
 * parentComment means deleting a top-level comment also removes its
 * replies (this codebase has no soft-delete convention anywhere to
 * preserve them instead — see Flashcard/FlashcardSet, both hard-deleted).
 *
 * The composite index backs findTopLevelForSet's listing query:
 * WHERE flashcard_set_id = :id AND parent_comment_id IS NULL
 * ORDER BY created_at DESC.
 */
@Entity('comments')
@Index(['flashcardSet', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => FlashcardSet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flashcard_set_id' })
  flashcardSet: Relation<FlashcardSet>;

  @Index()
  @ManyToOne(() => Comment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_comment_id' })
  parentComment: Relation<Comment> | null;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
