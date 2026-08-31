import type { CardRating } from "@/types/flashcard";

export interface AnswerButtonsProps {
  onAnswer: (rating: CardRating) => void;
}

interface RatingOption {
  rating: CardRating;
  label: string;
  hint: string;
  className: string;
}

const RATING_OPTIONS: RatingOption[] = [
  {
    rating: "again",
    label: "Again",
    hint: "1",
    className: "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10",
  },
  {
    rating: "hard",
    label: "Hard",
    hint: "2",
    className: "border-secondary/30 bg-secondary/5 text-secondary hover:bg-secondary/10",
  },
  {
    rating: "good",
    label: "Good",
    hint: "3",
    className: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
  },
  {
    rating: "easy",
    label: "Easy",
    hint: "4",
    className: "border-success/30 bg-success/5 text-success hover:bg-success/10",
  },
];

// Shown once a card is flipped — separate from StudyControls because these
// record per-card mastery (feeding StudyProgress and the spaced-repetition
// scheduler on the backend), not just navigate.
export function AnswerButtons({ onAnswer }: AnswerButtonsProps) {
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
            {option.label}
            <span className="text-xs font-normal opacity-60">{option.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-text-muted">
        Again = review now · Hard/Good/Easy space out the next review
      </p>
    </div>
  );
}
