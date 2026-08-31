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
import { User } from '../../users/entities/user.entity.js';
import { Flashcard } from '../../flashcards/entities/flashcard.entity.js';

export enum ProgressStatus {
  NEW = 'new',
  LEARNING = 'learning',
  MASTERED = 'mastered',
}

@Entity('study_progress')
@Unique(['user', 'flashcard'])
export class StudyProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, (user) => user.studyProgress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Flashcard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flashcard_id' })
  flashcard: Relation<Flashcard>;

  @Column({ type: 'enum', enum: ProgressStatus, default: ProgressStatus.NEW })
  status: ProgressStatus;

  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount: number;

  @Column({ name: 'incorrect_count', type: 'int', default: 0 })
  incorrectCount: number;

  // Drives the scheduler in ../scheduling.ts: repetitions is the current
  // step on the interval table, intervalDays is the gap (in days) until
  // this card is due again. Both reset to 0 on an AGAIN rating.
  @Column({ type: 'int', default: 0 })
  repetitions: number;

  @Column({ name: 'interval_days', type: 'int', default: 0 })
  intervalDays: number;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null;

  @Index()
  @Column({ name: 'next_review_at', type: 'timestamptz', nullable: true })
  nextReviewAt: Date | null;
}
