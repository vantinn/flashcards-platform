import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { FlashcardSet } from '../../flashcard-sets/entities/flashcard-set.entity.js';

export enum StudyMode {
  FLASHCARD = 'flashcard',
}

@Entity('study_sessions')
export class StudySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, (user) => user.studySessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Index()
  @ManyToOne(() => FlashcardSet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'set_id' })
  set: Relation<FlashcardSet>;

  @Column({ type: 'enum', enum: StudyMode, default: StudyMode.FLASHCARD })
  mode: StudyMode;

  // See User entity for why `timestamptz` is explicit here.
  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cards_studied', type: 'int', default: 0 })
  cardsStudied: number;

  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount: number;

  @Column({ name: 'incorrect_count', type: 'int', default: 0 })
  incorrectCount: number;
}
