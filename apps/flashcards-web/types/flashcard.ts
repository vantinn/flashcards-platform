export type SetVisibility = "private" | "unlisted" | "public";
export type ProgressStatus = "new" | "learning" | "mastered";
export type CardRating = "again" | "hard" | "good" | "easy";

/**
 * The official Set Category ("Danh mục" — Tiếng Anh/Tiếng Trung/Tự do),
 * chosen at set creation and used to filter Explore/search. It doubles as
 * the driver for which Web Speech API voice pronunciation buttons use for a
 * set's cards, since for this product the two are the same axis.
 */
export type SetLanguage = "english" | "chinese" | "free";

export type Gender = "male" | "female";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  gender: Gender | null;
  onboardingCompleted: boolean;
}

/** Safe third-party exposure of a set's owner — never includes email. */
export interface OwnerSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FlashcardSet {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  language: SetLanguage;
  visibility: SetVisibility;
  cardCount: number;
  studyCount: number;
  createdAt: string;
  updatedAt: string;
  /** Only present on Explore/search results (visibility === "public"). */
  creator?: OwnerSummary;
  likeCount?: number;
  commentCount?: number;
  likedByCurrentUser?: boolean;
}

/** GET /flashcard-sets/:id/social — only ever fetched for a public set. */
export interface SocialSummary {
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
}

/** A top-level comment or a reply — the API returns the same shape for both. */
export interface SetComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: OwnerSummary;
  replyCount: number;
  canEdit: boolean;
  canDelete: boolean;
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
