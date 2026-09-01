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

// The official Set Category ("Danh mục") shown at set-creation and used to
// filter Explore/search — English/Chinese/Free. It doubles as the driver for
// which Web Speech API voice study/cram/deep-learning pronunciation buttons
// use for this set's cards, since for this product the two are the same
// axis: a Chinese-category set is, by definition, pronounced in Chinese.
// A separate free-text `category` column used to exist alongside this and
// was retired in favor of this single controlled enum — see the
// `1788073338788-InitFlashcardSchema`/`1788169370139-AddCategoryIndex`
// migrations for that now-orphaned (but data-preserving, never dropped)
// column.
export enum SetLanguage {
  ENGLISH = 'english',
  CHINESE = 'chinese',
  FREE = 'free',
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

  @Index()
  @Column({ type: 'enum', enum: SetVisibility, default: SetVisibility.PRIVATE })
  visibility: SetVisibility;

  @Index()
  @Column({ type: 'enum', enum: SetLanguage, default: SetLanguage.FREE })
  language: SetLanguage;

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
