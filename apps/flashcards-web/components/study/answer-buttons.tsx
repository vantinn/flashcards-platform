"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import type { Translator, TranslationKey } from "@/lib/i18n/dictionary";
import type { CardRating } from "@/types/flashcard";

export interface AnswerButtonsProps {
  onAnswer: (rating: CardRating) => void;
}

interface RatingOption {
  rating: CardRating;
  labelKey: TranslationKey;
  hint: string;
  className: string;
}

const RATING_OPTIONS: RatingOption[] = [
  {
    rating: "again",
    labelKey: "study.ratingAgain",
    hint: "1",
    className: "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10",
  },
  {
    rating: "hard",
    labelKey: "study.ratingHard",
    hint: "2",
    className: "border-secondary/30 bg-secondary/5 text-secondary hover:bg-secondary/10",
  },
  {
    rating: "good",
    labelKey: "study.ratingGood",
    hint: "3",
    className: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
  },
  {
    rating: "easy",
    labelKey: "study.ratingEasy",
    hint: "4",
    className: "border-success/30 bg-success/5 text-success hover:bg-success/10",
  },
];

// Shown once a card is flipped — separate from StudyControls because these
// record per-card mastery (feeding StudyProgress and the spaced-repetition
// scheduler on the backend), not just navigate.
export function AnswerButtons({ onAnswer }: AnswerButtonsProps) {
  const { t }: { t: Translator } = useI18n();
  return (
    <div className="flex w-full max-w-2xl animate-fade-in flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RATING_OPTIONS.map((option) => (
          <button
            key={option.rating}
            type="button"
            onClick={() => onAnswer(option.rating)}
            className={`flex flex-col items-center gap-0.5 rounded-card-lg border py-4 text-base font-semibold transition-colors ${option.className}`}
          >
            {t(option.labelKey)}
            <span className="text-xs font-normal opacity-60">{option.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-text-muted">{t("study.ratingHint")}</p>
    </div>
  );
}
