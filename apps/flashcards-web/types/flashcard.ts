export type SetVisibility = "private" | "unlisted" | "public";
export type ProgressStatus = "new" | "learning" | "mastered";
export type CardRating = "again" | "hard" | "good" | "easy";

/** Drives which Web Speech API voice pronunciation buttons use for a set's cards. */
export type SetLanguage = "english" | "chinese" | "free";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FlashcardSet {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  category: string | null;
  language: SetLanguage;
  visibility: SetVisibility;
  cardCount: number;
  studyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /flashcard-sets/:id's shape — the base set plus its cards and creator. */
export interface FlashcardSetDetail extends FlashcardSet {
  cards: Flashcard[];
  creator: PublicUser;
}

export interface StudySession {
  id: string;
  mode: "flashcard";
  startedAt: string;
  completedAt: string | null;
  cardsStudied: number;
  correctCount: number;
  incorrectCount: number;
  set: FlashcardSet;
}

export interface StudyProgress {
  id: string;
  status: ProgressStatus;
  correctCount: number;
  incorrectCount: number;
  repetitions: number;
  intervalDays: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  flashcard: Flashcard;
}

export interface DueSet {
  id: string;
  title: string;
  dueCount: number;
}

/** GET /progress/summary — aggregate counts computed server-side, not derived from a raw progress list. */
export interface ProgressSummary {
  totalTracked: number;
  learningCount: number;
  masteredCount: number;
  dueCount: number;
  dueSet: DueSet | null;
}

/** GET /study-sessions/stats */
export interface StudyStats {
  streakDays: number;
  reviewsToday: number;
}
