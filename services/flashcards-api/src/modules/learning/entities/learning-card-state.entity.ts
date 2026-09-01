import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { LearningSession } from './learning-session.entity.js';
import { Flashcard } from '../../flashcards/entities/flashcard.entity.js';

/**
 * Per-card state within one LearningSession progression. Shared shape for
 * both CRAM and DEEP_LEARNING (the session's `mode` says which fields are
 * meaningful) rather than two near-identical tables:
 *
 * - CRAM only ever uses `completed`/`attempts`/`dueSequence` — a card is
 *   done after one correct answer.
 * - DEEP_LEARNING additionally uses `mcCompleted`/`typedCompleted` (a card
 *   is `completed` only once both are true) and the SRS fields, which
 *   track a *separate* longer-horizon "when to review again" schedule —
 *   see LearningService for why that must never be conflated with
 *   `dueSequence`, which only governs the short-term in-session retry
 *   queue.
 */
@Entity('learning_card_states')
@Unique(['session', 'flashcard'])
export class LearningCardState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => LearningSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Relation<LearningSession>;

  @ManyToOne(() => Flashcard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flashcard_id' })
  flashcard: Relation<Flashcard>;

  // Permanently done within this progression — never resets once true.
  @Index()
  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'correct_attempts', type: 'int', default: 0 })
  correctAttempts: number;

  @Column({ name: 'incorrect_attempts', type: 'int', default: 0 })
  incorrectAttempts: number;

  // This card is eligible to be served again once session.sequence >=
  // dueSequence. Set on both a wrong answer and (DEEP_LEARNING) on passing
  // the multiple-choice stage, so the same card never gets served twice in
  // a row. See ../algorithms/retry-queue.ts.
  @Column({ name: 'due_sequence', type: 'int', default: 0 })
  dueSequence: number;

  @Column({ name: 'mc_completed', type: 'boolean', default: false })
  mcCompleted: boolean;

  @Column({ name: 'typed_completed', type: 'boolean', default: false })
  typedCompleted: boolean;

  // Longer-horizon spaced-repetition fields, populated after every
  // DEEP_LEARNING answer via the existing scheduleNextReview() scheduler.
  // Recorded for future use; never read when computing this session's
  // completion or picking the next question.
  @Column({ type: 'int', default: 0 })
  repetitions: number;

  @Column({ name: 'interval_days', type: 'int', default: 0 })
  intervalDays: number;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null;

  @Column({ name: 'next_review_at', type: 'timestamptz', nullable: true })
  nextReviewAt: Date | null;
}
