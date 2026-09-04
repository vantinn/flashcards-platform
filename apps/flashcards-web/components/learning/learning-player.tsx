"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CheckCircleIcon, XIcon } from "@/components/ui/icons";
import { McQuestion } from "./mc-question";
import { TypedQuestion } from "./typed-question";
import { PronunciationButton } from "@/components/pronunciation/pronunciation-button";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useI18n } from "@/lib/i18n/i18n-context";
import type {
  LearningAnswerResult,
  LearningMode,
  LearningQuestionView,
  LearningSessionSummary,
  StartLearningSessionResponse,
} from "@/types/learning";

export interface LearningPlayerProps {
  setId: string;
  setTitle: string;
  mode: LearningMode;
  icon: ReactNode;
  title: string;
  completionMessage: string;
  /** BCP-47 tag for pronunciation, or null for a Free-category set. */
  language?: string | null;
}

type Phase = "starting" | "blocked" | "error" | "playing" | "completed";

interface Feedback {
  correct: boolean;
  correctAnswer: string;
  selectedText: string | null;
}

/**
 * Shared player for both learning modes — Cram is just Deep Learning with
 * every card's multiple-choice-only path, so one player driven by
 * `question.type` (server-decided) avoids duplicating the same
 * start/resume/answer/feedback machinery per mode.
 */
export function LearningPlayer({ setId, setTitle, mode, icon, title, completionMessage, language = null }: LearningPlayerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<LearningSessionSummary | null>(null);
  const [question, setQuestion] = useState<LearningQuestionView | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A genuine mount-time side effect (POSTs to create/resume a session),
  // same justification as StudyPlayer's fetchSession effect.
  const start = useCallback(async () => {
    setPhase("starting");
    setErrorMessage(null);
    setFeedback(null);
    try {
      const result = await api.post<StartLearningSessionResponse>("/learning-sessions/start", { setId, mode });
      setSession(result.session);
      setQuestion(result.question);
      setPhase(result.session.status === "completed" ? "completed" : "playing");
    } catch (err) {
      const message = err instanceof ApiError ? getErrorMessage(err, t) : t("learning.couldNotStart");
      if (err instanceof ApiError && err.status === 400) {
        setErrorMessage(message);
        setPhase("blocked");
      } else {
        setErrorMessage(message);
        setPhase("error");
      }
    }
  }, [setId, mode, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment on start() above
    start();
  }, [start]);

  const refetchAfterConflict = useCallback(
    async (sessionId: string) => {
      try {
        const [freshSession, freshQuestion] = await Promise.all([
          api.get<LearningSessionSummary>(`/learning-sessions/${sessionId}`),
          api.get<LearningQuestionView | null>(`/learning-sessions/${sessionId}/question`),
        ]);
        setSession(freshSession);
        setQuestion(freshQuestion);
        setFeedback(null);
        setPhase(freshSession.status === "completed" ? "completed" : "playing");
      } catch {
        setErrorMessage(t("learning.couldNotRefresh"));
        setPhase("error");
      }
    },
    [t],
  );

  async function submitAnswer(payload: { selectedText?: string; typedText?: string }) {
    if (!session || !question || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.post<LearningAnswerResult>(`/learning-sessions/${session.id}/answer`, {
        flashcardId: question.flashcardId,
        ...payload,
      });
      setFeedback({ correct: result.correct, correctAnswer: result.correctAnswer, selectedText: payload.selectedText ?? null });
      setSession(result.session);

      // Correct answers auto-advance quickly; a wrong answer holds the
      // feedback (which choice was picked vs. the correct one) on screen
      // long enough to read before moving on.
      const delay = result.correct ? 500 : 1600;
      window.setTimeout(() => {
        setFeedback(null);
        setQuestion(result.nextQuestion);
        setPhase(result.session.status === "completed" ? "completed" : "playing");
        setSubmitting(false);
      }, delay);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The question this answer targeted is stale (a lost-response retry
        // or a second tab already answered it) — the prior answer already
        // landed, so silently resync instead of showing an error.
        await refetchAfterConflict(session.id);
        setSubmitting(false);
      } else {
        setErrorMessage(err instanceof ApiError ? getErrorMessage(err, t) : t("learning.couldNotSubmit"));
        setSubmitting(false);
      }
    }
  }

  function handleExit() {
    router.push(`/sets/${setId}`);
  }

  if (phase === "starting") {
    return <Loading label={t("learning.preparing")} />;
  }

  if (phase === "blocked") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <ErrorState title={t("learning.couldNotStartTitle")} description={errorMessage ?? undefined} />
        <Button variant="outline" onClick={handleExit}>
          {t("learning.backToSet")}
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <ErrorState title={t("learning.errorTitle")} description={errorMessage ?? undefined} />
        <Button onClick={start}>{t("learning.tryAgain")}</Button>
      </div>
    );
  }

  if (phase === "completed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16">
        <Card className="w-full max-w-md animate-fade-up">
          <CardBody className="flex flex-col items-center gap-5 py-10 text-center">
            <CheckCircleIcon className="h-10 w-10 text-success" />
            <div>
              <h1 className="text-xl font-bold text-text-dark">{t("learning.congratulations")}</h1>
              <p className="text-sm text-text-muted">{completionMessage}</p>
              <p className="mt-1 text-sm font-medium text-text-dark">{setTitle}</p>
            </div>
            <Button className="w-full" onClick={handleExit}>
              {t("learning.backToSet")}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!question) {
    return <ErrorState title={t("learning.noQuestionsTitle")} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8 sm:gap-8">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold uppercase tracking-wide text-primary">
          {icon}
          {title}
        </p>
        <button
          type="button"
          onClick={handleExit}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-dark"
        >
          <XIcon className="h-4 w-4" />
          {t("learning.exit")}
        </button>
      </div>

      {session ? (
        <div className="flex w-full max-w-2xl flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>{t("learning.progressXOfY", { completed: session.progress.completed, total: session.progress.total })}</span>
            <span>{session.progress.percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${session.progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {question.type === "multiple_choice" ? (
        <McQuestion
          key={question.flashcardId + question.type}
          front={question.front ?? ""}
          choices={question.choices ?? []}
          disabled={submitting}
          selectedText={feedback?.selectedText ?? null}
          correctAnswer={feedback?.correctAnswer ?? null}
          onSelect={(choice) => submitAnswer({ selectedText: choice })}
          language={language}
        />
      ) : (
        <TypedQuestion
          key={question.flashcardId + question.type}
          back={question.back ?? ""}
          disabled={submitting}
          onSubmit={(typedText) => submitAnswer({ typedText })}
        />
      )}

      <div className="flex items-center gap-2">
        <p
          aria-live="polite"
          className={
            feedback
              ? feedback.correct
                ? "text-sm font-medium text-success"
                : "text-sm font-medium text-danger"
              : "text-sm text-text-muted"
          }
        >
          {feedback
            ? feedback.correct
              ? t("learning.correct")
              : t("learning.incorrectAnswerIs", { answer: feedback.correctAnswer })
            : question.type === "multiple_choice"
              ? t("learning.chooseAnswer")
              : t("learning.typeYourAnswer")}
        </p>
        {/*
          Typed Answer only: the backend withholds the target word (front)
          until after submission, so pronunciation can only appear here, next
          to the just-revealed correctAnswer — never before the user types.
        */}
        {question.type === "typed_answer" && feedback ? (
          <PronunciationButton text={feedback.correctAnswer} language={language} compact />
        ) : null}
      </div>
    </div>
  );
}
