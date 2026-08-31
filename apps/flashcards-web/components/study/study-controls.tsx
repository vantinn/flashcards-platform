import { Button } from "@/components/ui/button";

export interface StudyControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRestart: () => void;
  onExit: () => void;
  canGoPrevious: boolean;
  nextLabel?: string;
}

export function StudyControls({
  onPrevious,
  onNext,
  onShuffle,
  onRestart,
  onExit,
  canGoPrevious,
  nextLabel = "Next",
}: StudyControlsProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      <div className="flex w-full items-center justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          aria-label="Previous card"
          className="min-w-[44px]"
        >
          ← Previous
        </Button>
        <Button size="lg" onClick={onNext} aria-label={nextLabel} className="min-w-[44px]">
          {nextLabel} →
        </Button>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <button
          type="button"
          onClick={onShuffle}
          className="rounded-card px-3 py-2 font-medium text-text-muted hover:bg-black/5 hover:text-text-dark"
        >
          🔀 Shuffle
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-card px-3 py-2 font-medium text-text-muted hover:bg-black/5 hover:text-text-dark"
        >
          ↺ Restart
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-card px-3 py-2 font-medium text-text-muted hover:bg-black/5 hover:text-text-dark"
        >
          ✕ Exit
        </button>
      </div>
    </div>
  );
}
