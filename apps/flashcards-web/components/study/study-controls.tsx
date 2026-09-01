"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, ShuffleIcon, RotateCcwIcon, XIcon } from "@/components/ui/icons";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface StudyControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRestart: () => void;
  onExit: () => void;
  canGoPrevious: boolean;
  isLastCard: boolean;
}

export function StudyControls({
  onPrevious,
  onNext,
  onShuffle,
  onRestart,
  onExit,
  canGoPrevious,
  isLastCard,
}: StudyControlsProps) {
  const { t } = useI18n();
  const nextLabel = isLastCard ? t("study.finish") : t("study.next");

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      <div className="flex w-full items-center justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          aria-label={t("study.previous")}
          className="min-w-[44px] gap-1.5"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("study.previous")}
        </Button>
        <Button size="lg" onClick={onNext} aria-label={nextLabel} className="min-w-[44px] gap-1.5">
          {nextLabel}
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <button
          type="button"
          onClick={onShuffle}
          className="flex items-center gap-1.5 rounded-card px-3 py-2 font-medium text-text-muted hover:bg-black/5 hover:text-text-dark"
        >
          <ShuffleIcon className="h-4 w-4" />
          {t("study.shuffle")}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center gap-1.5 rounded-card px-3 py-2 font-medium text-text-muted hover:bg-black/5 hover:text-text-dark"
        >
          <RotateCcwIcon className="h-4 w-4" />
          {t("study.restart")}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-card px-3 py-2 font-medium text-text-muted hover:bg-black/5 hover:text-text-dark"
        >
          <XIcon className="h-4 w-4" />
          {t("study.exit")}
        </button>
      </div>
    </div>
  );
}
