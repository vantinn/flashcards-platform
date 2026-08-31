"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlashcardFlip } from "./flashcard-flip";
import { StudyProgress } from "./study-progress";
import { StudyControls } from "./study-controls";
import { AnswerButtons } from "./answer-buttons";
import { StudyCompletion } from "./study-completion";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import type { CardRating, Flashcard } from "@/types/flashcard";

export interface StudyPlayerProps {
  setId: string;
  setTitle: string;
  cards: Flashcard[];
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function StudyPlayer({ setId, setTitle, cards }: StudyPlayerProps) {
  const router = useRouter();
  const [order, setOrder] = useState<Flashcard[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Map<string, CardRating>>(new Map());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Starting a study session is a real side effect tied to mounting this
  // component (it POSTs to create a StudySession row) — not a case the
  // "you might not need an effect" guidance is arguing against. The
  // react-hooks/set-state-in-effect rule flags any mount-effect that leads
  // to a setState call at all, sync or not, so it's disabled below rather
  // than contorting this into something else just to satisfy the linter.
  const fetchSession = useCallback(async () => {
    try {
      const session = await api.post<{ id: string }>("/study-sessions", { setId });
      setSessionId(session.id);
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : "Could not start a study session.");
    } finally {
      setStarting(false);
    }
  }, [setId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment on fetchSession above
    fetchSession();
  }, [fetchSession]);

  function retryStart() {
    setStarting(true);
    setStartError(null);
    fetchSession();
  }

  const currentCard = order[index];

  const finishSession = useCallback(
    async (finalAnswers: Map<string, CardRating>) => {
      if (!sessionId || finalAnswers.size === 0) {
        setCompleted(true);
        return;
      }
      setCompleting(true);
      try {
        await api.post(`/study-sessions/${sessionId}/complete`, {
          results: Array.from(finalAnswers.entries()).map(([flashcardId, rating]) => ({
            flashcardId,
            rating,
          })),
        });
      } catch {
        // Progress tracking failing shouldn't trap the user on the study
        // screen — still show the local summary either way.
      } finally {
        setCompleting(false);
        setCompleted(true);
      }
    },
    [sessionId],
  );

  const goNext = useCallback(() => {
    setIndex((current) => {
      if (current >= order.length - 1) {
        finishSession(answers);
        return current;
      }
      return current + 1;
    });
    setFlipped(false);
  }, [order.length, answers, finishSession]);

  const goPrevious = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
    setFlipped(false);
  }, []);

  function handleAnswer(rating: CardRating) {
    if (!currentCard) return;

    // Deliberately not routed through goNext(): goNext is memoized with
    // `answers` as a dependency, so calling setAnswers and then goNext()
    // synchronously in the same handler still runs goNext's closure from
    // *before* this render — it would finish the session missing whichever
    // card was just answered. Computing the updated map here and using it
    // directly sidesteps that stale-closure gap entirely.
    const updatedAnswers = new Map(answers).set(currentCard.id, rating);
    setAnswers(updatedAnswers);

    if (index >= order.length - 1) {
      finishSession(updatedAnswers);
    } else {
      setIndex((current) => current + 1);
      setFlipped(false);
    }
  }

  function handleShuffle() {
    setOrder(shuffleArray(order));
    setIndex(0);
    setFlipped(false);
  }

  function handleRestart() {
    setOrder(shuffleArray(cards));
    setIndex(0);
    setFlipped(false);
    setAnswers(new Map());
    setCompleted(false);
    retryStart();
  }

  function handleExit() {
    router.push(`/sets/${setId}`);
  }

  // Keyboard shortcuts: Space flips, 1-4 rate a flipped card (Again/Hard/
  // Good/Easy), ArrowRight/Left navigate, Escape exits.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (completed || starting) return;
      const target = event.target;
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (flipped && ["Digit1", "Digit2", "Digit3", "Digit4"].includes(event.code)) {
        event.preventDefault();
        const rating: CardRating = (["again", "hard", "good", "easy"] as const)[
          Number(event.code.slice(-1)) - 1
        ];
        handleAnswer(rating);
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          setFlipped((f) => !f);
          break;
        case "ArrowRight":
          event.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          event.preventDefault();
          goPrevious();
          break;
        case "Escape":
          event.preventDefault();
          router.push(`/sets/${setId}`);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // handleAnswer isn't memoized, but that's fine here: `flipped` is already a dependency, so every
    // false->true flip re-binds this listener with a fresh handleAnswer closure. Nothing else handleAnswer
    // reads (answers/index/currentCard) can change while flipped stays true — the only way to touch them is
    // handleAnswer itself, which always resets flipped to false right after. So the closure captured at
    // flip-time is never stale while it's actually usable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, starting, flipped, goNext, goPrevious, router, setId]);

  if (starting) {
    return <Loading label="Starting study session..." />;
  }

  if (startError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <ErrorState title="Couldn't start studying" description={startError} />
        <Button onClick={retryStart}>Try again</Button>
      </div>
    );
  }

  if (completing) {
    return <Loading label="Saving your progress..." />;
  }

  if (completed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16">
        <StudyCompletion
          setId={setId}
          setTitle={setTitle}
          correctCount={[...answers.values()].filter((rating) => rating !== "again").length}
          incorrectCount={[...answers.values()].filter((rating) => rating === "again").length}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  if (!currentCard) {
    return <ErrorState title="This set has no cards to study" />;
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8 sm:gap-8">
      <p className="w-full max-w-2xl truncate text-center text-sm font-semibold uppercase tracking-wide text-primary">
        {setTitle}
      </p>
      <StudyProgress current={index} total={order.length} />
      <FlashcardFlip front={currentCard.front} back={currentCard.back} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
      {flipped ? (
        <AnswerButtons onAnswer={handleAnswer} />
      ) : (
        <p className="text-sm text-text-muted" aria-live="polite">
          Flip the card to answer
        </p>
      )}
      <StudyControls
        onPrevious={goPrevious}
        onNext={goNext}
        onShuffle={handleShuffle}
        onRestart={handleRestart}
        onExit={handleExit}
        canGoPrevious={index > 0}
        nextLabel={index === order.length - 1 ? "Finish" : "Next"}
      />
    </div>
  );
}
