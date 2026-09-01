"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { PronunciationButton } from "@/components/pronunciation/pronunciation-button";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface FlashcardFlipProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  /** BCP-47 tag for pronunciation, or null for a Free-category set (hides the speaker button). */
  language?: string | null;
}

export function FlashcardFlip({ front, back, flipped, onFlip, language = null }: FlashcardFlipProps) {
  const { t } = useI18n();

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
        aria-label={flipped ? t("study.flipAriaShowingAnswer") : t("study.flipAriaShowingQuestion")}
        className="h-full w-full cursor-pointer text-left"
      >
        <div className={cn("flip-card-inner", flipped && "is-flipped")}>
          <div
            className={cn(
              "flip-card-face flex flex-col items-center justify-center gap-3 rounded-card-lg border border-border bg-white p-8 text-center shadow-card-lg sm:p-12",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("study.question")}</span>
            <p className="text-xl font-semibold text-text-dark sm:text-2xl">{front}</p>
            <div onClick={(event) => event.stopPropagation()}>
              <PronunciationButton text={front} language={language} />
            </div>
            <span className="mt-2 text-xs text-text-muted">{t("study.flipHint")}</span>
          </div>
          <div
            className={cn(
              "flip-card-face flip-card-face-back flex flex-col items-center justify-center gap-3 rounded-card-lg border border-primary/30 bg-primary/5 p-8 text-center shadow-card-lg sm:p-12",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t("study.answer")}</span>
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
