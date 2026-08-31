"use client";

import { cn } from "@/lib/cn";

export interface FlashcardFlipProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
}

export function FlashcardFlip({ front, back, flipped, onFlip }: FlashcardFlipProps) {
  return (
    <div className="flip-card aspect-[3/2] w-full max-w-2xl">
      <button
        type="button"
        onClick={onFlip}
        aria-pressed={flipped}
        aria-label={flipped ? "Showing answer. Tap to show question." : "Showing question. Tap to show answer."}
        className="h-full w-full cursor-pointer text-left"
      >
        <div className={cn("flip-card-inner", flipped && "is-flipped")}>
          <div
            className={cn(
              "flip-card-face flex flex-col items-center justify-center gap-3 rounded-card-lg border border-border bg-white p-8 text-center shadow-card-lg sm:p-12",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Question</span>
            <p className="text-xl font-semibold text-text-dark sm:text-2xl">{front}</p>
            <span className="mt-2 text-xs text-text-muted">Tap or press space to flip</span>
          </div>
          <div
            className={cn(
              "flip-card-face flip-card-face-back flex flex-col items-center justify-center gap-3 rounded-card-lg border border-primary/30 bg-primary/5 p-8 text-center shadow-card-lg sm:p-12",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Answer</span>
            <p className="text-xl font-semibold text-text-dark sm:text-2xl">{back}</p>
          </div>
        </div>
      </button>
    </div>
  );
}
