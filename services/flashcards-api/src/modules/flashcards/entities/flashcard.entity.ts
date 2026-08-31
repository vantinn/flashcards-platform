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
import { FlashcardSet } from '../../flashcard-sets/entities/flashcard-set.entity.js';

@Entity('flashcards')
export class Flashcard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => FlashcardSet, (set) => set.cards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'set_id' })
  set: Relation<FlashcardSet>;

  @Column({ type: 'text' })
  front: string;

  @Column({ type: 'text' })
  back: string;

  @Column({ name: 'front_image_url', type: 'text', nullable: true })
  frontImageUrl: string | null;

  @Column({ name: 'back_image_url', type: 'text', nullable: true })
  backImageUrl: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  // See User entity for why `timestamptz` is explicit here.
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
