"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { PronunciationButton } from "@/components/pronunciation/pronunciation-button";

export interface FlashcardFlipProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  /** BCP-47 tag for pronunciation, or null for a Free-category set (hides the speaker button). */
  language?: string | null;
}

export function FlashcardFlip({ front, back, flipped, onFlip, language = null }: FlashcardFlipProps) {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onFlip();
    }
  }

  return (
    <div className="flip-card aspect-[3/2] w-full max-w-2xl">
      {/*
        A div with role="button" rather than a real <button> — the card
        contains the pronunciation button (its own <button>), and a
        <button> cannot validly contain another interactive element.
      */}
      <div
        role="button"
        tabIndex={0}
        onClick={onFlip}
        onKeyDown={handleKeyDown}
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
            <div onClick={(event) => event.stopPropagation()}>
              <PronunciationButton text={front} language={language} />
            </div>
            <span className="mt-2 text-xs text-text-muted">Tap or press space to flip</span>
          </div>
          <div
            className={cn(
              "flip-card-face flip-card-face-back flex flex-col items-center justify-center gap-3 rounded-card-lg border border-primary/30 bg-primary/5 p-8 text-center shadow-card-lg sm:p-12",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Answer</span>
            <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <p className="text-lg font-semibold text-text-dark">{front}</p>
              <PronunciationButton text={front} language={language} compact />
            </div>
            <p className="text-xl font-semibold text-text-dark sm:text-2xl">{back}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
