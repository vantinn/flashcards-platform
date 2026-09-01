import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { FlashcardSet } from '../../flashcard-sets/entities/flashcard-set.entity.js';
import { Flashcard } from '../../flashcards/entities/flashcard.entity.js';

export enum LearningMode {
  CRAM = 'cram',
  DEEP_LEARNING = 'deep_learning',
}

export enum LearningSessionStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum LearningQuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TYPED_ANSWER = 'typed_answer',
}

/**
 * One finite, resumable learning progression for a (user, set, mode)
 * triple. At most one row can ever exist per triple (see the unique
 * constraint below) — that's what makes "resume" a lookup instead of a
 * "most recently active session" heuristic, and what prevents duplicate
 * unfinished sessions from ever being created.
 *
 * `currentCard`/`currentQuestionType`/`currentChoices` persist exactly the
 * question currently being served, so a refresh or reconnect replays the
 * same question (same distractors, same order) instead of silently
 * skipping a card or generating a different quiz. Invariant: `currentCard`
 * is non-null iff `status = IN_PROGRESS`.
 */
@Entity('learning_sessions')
@Unique(['user', 'set', 'mode'])
export class LearningSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Index()
  @ManyToOne(() => FlashcardSet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'set_id' })
  set: Relation<FlashcardSet>;

  @Column({ type: 'enum', enum: LearningMode })
  mode: LearningMode;

  @Index()
  @Column({ type: 'enum', enum: LearningSessionStatus, default: LearningSessionStatus.IN_PROGRESS })
  status: LearningSessionStatus;

  // Monotonic clock for this progression, incremented once per answer
  // submission. Drives the retry queue in ../algorithms/retry-queue.ts —
  // deliberately not wall-clock time, since "N other answers must happen
  // first" is what the product spec asks for, not "N minutes must pass".
  @Column({ type: 'int', default: 0 })
  sequence: number;

  @ManyToOne(() => Flashcard, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'current_card_id' })
  currentCard: Relation<Flashcard> | null;

  @Column({ name: 'current_question_type', type: 'enum', enum: LearningQuestionType, nullable: true })
  currentQuestionType: LearningQuestionType | null;

  // The exact choice texts served for the current question, in their
  // randomized order — persisted so a refresh shows the identical choices
  // rather than a freshly (and differently) shuffled set. Null for a
  // TYPED_ANSWER question.
  @Column({ name: 'current_choices', type: 'jsonb', nullable: true })
  currentChoices: string[] | null;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @UpdateDateColumn({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt: Date;
}
