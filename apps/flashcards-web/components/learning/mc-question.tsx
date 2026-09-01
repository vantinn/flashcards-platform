"use client";

import { cn } from "@/lib/cn";

export interface McQuestionProps {
  front: string;
  choices: string[];
  disabled: boolean;
  selectedText: string | null;
  correctAnswer: string | null;
  onSelect: (choice: string) => void;
}

export function McQuestion({ front, choices, disabled, selectedText, correctAnswer, onSelect }: McQuestionProps) {
  const showFeedback = correctAnswer !== null;

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6">
      <div className="w-full rounded-card-lg border border-border bg-white p-8 text-center shadow-card-lg sm:p-12">
        <p className="text-xl font-semibold text-text-dark sm:text-2xl">{front}</p>
        <p className="mt-2 text-sm text-text-muted">{front} có nghĩa là gì?</p>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {choices.map((choice, index) => {
          const isSelected = selectedText === choice;
          const isCorrectChoice = correctAnswer === choice;
          return (
            <button
              key={choice}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(choice)}
              className={cn(
                "flex items-center gap-3 rounded-card border px-4 py-3 text-left text-sm font-medium transition-colors disabled:pointer-events-none",
                showFeedback && isCorrectChoice
                  ? "border-success bg-success/10 text-success"
                  : showFeedback && isSelected
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-border bg-white text-text-dark hover:border-primary hover:bg-primary/5",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">
                {String.fromCharCode(65 + index)}
              </span>
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}
