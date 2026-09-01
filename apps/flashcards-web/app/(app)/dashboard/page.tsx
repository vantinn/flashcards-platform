import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashcardSetCard } from "@/components/flashcards/flashcard-set-card";
import { MasteryBreakdown } from "@/components/study/mastery-breakdown";
import { serverApi, ApiError } from "@/lib/api-server";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator, type Translator } from "@/lib/i18n/dictionary";
import type { PublicUser, FlashcardSet, StudySession, ProgressSummary, StudyStats } from "@/types/flashcard";
import type { PaginatedResult } from "@/types/pagination";

const RECENT_SETS_LIMIT = 6;
const HISTORY_LIMIT = 10;

async function loadDashboard() {
  try {
    const [user, recentSets, history, progress, studyStats] = await Promise.all([
      serverApi.get<PublicUser>("/users/me"),
      serverApi.get<PaginatedResult<FlashcardSet>>(`/flashcard-sets?limit=${RECENT_SETS_LIMIT}`),
      serverApi.get<StudySession[]>(`/study-sessions?limit=${HISTORY_LIMIT}`),
      serverApi.get<ProgressSummary>("/progress/summary"),
      serverApi.get<StudyStats>("/study-sessions/stats"),
    ]);
    return { user, recentSets, history, progress, studyStats };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
}

function timeAgo(iso: string, t: Translator): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return t("dashboard.justNow");
  if (minutes < 60) return t("dashboard.minutesAgo", { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("dashboard.hoursAgo", { hours });
  const days = Math.round(hours / 24);
  return t("dashboard.daysAgo", { days });
}

export default async function DashboardPage() {
  const [{ user, recentSets, history, progress, studyStats }, locale] = await Promise.all([
    loadDashboard(),
    getLocale(),
  ]);
  const t = createTranslator(getDictionary(locale));

  const completedSessions = history.filter((session) => session.completedAt);

  // Most recent session per set, most-recently-studied set first.
  const recentlyStudied = Array.from(
    completedSessions.reduce((map, session) => {
      if (!map.has(session.set.id)) map.set(session.set.id, session);
      return map;
    }, new Map<string, StudySession>()).values(),
  ).slice(0, 3);

  const continueSet = history[0]?.set ?? null;

  const stats = [
    { label: t("dashboard.statToday"), value: studyStats.reviewsToday },
    { label: t("dashboard.statCardsDue"), value: progress.dueCount },
    { label: t("dashboard.statCardsStudied"), value: progress.totalTracked },
    {
      label: t("dashboard.statStreak"),
      value: studyStats.streakDays === 0 ? t("dashboard.streakEmpty") : t("dashboard.streakUnit", { days: studyStats.streakDays }),
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text-dark">{t("dashboard.welcomeBack", { name: user.displayName })}</h1>
        <p className="text-text-muted">{t("dashboard.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {continueSet ? (
          <Link href={`/sets/${continueSet.id}/study`}>
            <Button size="lg">{t("dashboard.continueStudying")}</Button>
          </Link>
        ) : null}
        {progress.dueSet ? (
          <Link href={`/sets/${progress.dueSet.id}/study`}>
            <Button size="lg" variant="outline">
              {t(progress.dueSet.dueCount === 1 ? "dashboard.reviewDueCards_one" : "dashboard.reviewDueCards_other", {
                count: progress.dueSet.dueCount,
              })}
            </Button>
          </Link>
        ) : null}
        <Link href="/sets/create">
          <Button size="lg" variant="outline">
            {t("dashboard.createSet")}
          </Button>
        </Link>
        <Link href="/explore">
          <Button size="lg" variant="outline">
            {t("dashboard.exploreSets")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-sm font-medium text-text-muted">{stat.label}</p>
              <p className="mt-1 text-3xl font-bold text-primary">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-dark">{t("dashboard.learningProgress")}</h2>
        {progress.totalTracked === 0 ? (
          <p className="text-sm text-text-muted">{t("dashboard.noProgressYet")}</p>
        ) : (
          <MasteryBreakdown learningCount={progress.learningCount} masteredCount={progress.masteredCount} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-dark">{t("dashboard.recentlyStudied")}</h2>
        {recentlyStudied.length === 0 ? (
          <EmptyState
            title={t("dashboard.noSessionsTitle")}
            description={t("dashboard.noSessionsDesc")}
            action={
              <Link href="/sets">
                <Button variant="outline">{t("dashboard.browseMySets")}</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {recentlyStudied.map((session) => (
              <FlashcardSetCard key={session.id} set={session.set} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-dark">{t("dashboard.recentActivity")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-text-muted">{t("dashboard.noActivity")}</p>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {history.slice(0, 8).map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/sets/${session.set.id}`} className="truncate font-medium text-text-dark hover:text-primary">
                      {session.set.title}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {session.completedAt
                        ? t("dashboard.completedCorrect", { correct: session.correctCount, total: session.cardsStudied })
                        : t("learning.inProgress")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-text-muted">{timeAgo(session.startedAt, t)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-dark">{t("dashboard.mySets")}</h2>
          <Link href="/sets" className="text-sm font-medium text-primary hover:underline">
            {recentSets.total > 0 ? t("dashboard.viewAllWithCount", { count: recentSets.total }) : t("dashboard.viewAll")}
          </Link>
        </div>
        {recentSets.items.length === 0 ? (
          <EmptyState
            title={t("sets.noSetsTitle")}
            description={t("sets.noSetsDesc")}
            action={
              <Link href="/sets/create">
                <Button>{t("sets.createASet")}</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentSets.items.map((set) => (
              <FlashcardSetCard key={set.id} set={set} />
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
