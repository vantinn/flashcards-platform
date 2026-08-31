import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Flashcard } from '../../flashcards/entities/flashcard.entity.js';

export enum SetVisibility {
  PRIVATE = 'private',
  UNLISTED = 'unlisted',
  PUBLIC = 'public',
}

@Entity('flashcard_sets')
export class FlashcardSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Index()
  @ManyToOne(() => User, (user) => user.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: Relation<User>;

  // Kept as a plain label instead of a separate Category entity/module for the
  // initial domain — promote to a real relation only if topic browsing needs
  // more than a flat string (avoids an unused module in the foundation phase).
  // Indexed: both Explore search and "my sets" filtering match on it exactly.
  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Index()
  @Column({ type: 'enum', enum: SetVisibility, default: SetVisibility.PRIVATE })
  visibility: SetVisibility;

  @Column({ name: 'card_count', type: 'int', default: 0 })
  cardCount: number;

  @Column({ name: 'study_count', type: 'int', default: 0 })
  studyCount: number;

  @OneToMany(() => Flashcard, (card) => card.set)
  cards: Relation<Flashcard>[];

  // See User entity for why `timestamptz` is explicit here.
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
