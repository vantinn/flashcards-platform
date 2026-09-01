export type LearningMode = "cram" | "deep_learning";
export type LearningSessionStatus = "in_progress" | "completed";
export type LearningQuestionType = "multiple_choice" | "typed_answer";

export interface LearningProgress {
  completed: number;
  total: number;
  percent: number;
}

export interface LearningSessionSummary {
  id: string;
  mode: LearningMode;
  status: LearningSessionStatus;
  progress: LearningProgress;
  startedAt: string;
  completedAt: string | null;
}

/** GET/POST responses never carry which choice is correct — only the server ever knows that. */
export interface LearningQuestionView {
  type: LearningQuestionType;
  flashcardId: string;
  /** Present only for multiple_choice. */
  front?: string;
  /** Present only for typed_answer. */
  back?: string;
  /** Present only for multiple_choice — always exactly 4 entries. */
  choices?: string[];
}

export interface LearningAnswerResult {
  correct: boolean;
  correctAnswer: string;
  session: LearningSessionSummary;
  nextQuestion: LearningQuestionView | null;
}

export interface StartLearningSessionResponse {
  session: LearningSessionSummary;
  question: LearningQuestionView | null;
}
