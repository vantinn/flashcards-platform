import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashcardSetCard } from "@/components/flashcards/flashcard-set-card";
import { MasteryBreakdown } from "@/components/study/mastery-breakdown";
import { serverApi, ApiError } from "@/lib/api-server";
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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function DashboardPage() {
  const { user, recentSets, history, progress, studyStats } = await loadDashboard();

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
    { label: "Today's reviews", value: studyStats.reviewsToday },
    { label: "Cards due", value: progress.dueCount },
    { label: "Cards studied", value: progress.totalTracked },
    { label: "Study streak", value: studyStats.streakDays === 0 ? "—" : `${studyStats.streakDays}d` },
  ];

  return (
    <PageContainer className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text-dark">Welcome back, {user.displayName}</h1>
        <p className="text-text-muted">Here&apos;s a snapshot of your learning activity.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {continueSet ? (
          <Link href={`/sets/${continueSet.id}/study`}>
            <Button size="lg">Continue studying</Button>
          </Link>
        ) : null}
        {progress.dueSet ? (
          <Link href={`/sets/${progress.dueSet.id}/study`}>
            <Button size="lg" variant="outline">
              Review {progress.dueSet.dueCount} due card{progress.dueSet.dueCount === 1 ? "" : "s"}
            </Button>
          </Link>
        ) : null}
        <Link href="/sets/create">
          <Button size="lg" variant="outline">
            Create set
          </Button>
        </Link>
        <Link href="/explore">
          <Button size="lg" variant="outline">
            Explore sets
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
        <h2 className="text-lg font-semibold text-text-dark">Learning progress</h2>
        {progress.totalTracked === 0 ? (
          <p className="text-sm text-text-muted">
            Answer cards during a study session to start tracking progress here.
          </p>
        ) : (
          <MasteryBreakdown learningCount={progress.learningCount} masteredCount={progress.masteredCount} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-dark">Recently studied</h2>
        {recentlyStudied.length === 0 ? (
          <EmptyState
            title="No study sessions yet"
            description="Start studying a set to see your recent activity here."
            action={
              <Link href="/sets">
                <Button variant="outline">Browse my sets</Button>
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
        <h2 className="text-lg font-semibold text-text-dark">Recent activity</h2>
        {history.length === 0 ? (
          <p className="text-sm text-text-muted">No activity yet.</p>
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
                        ? `Completed · ${session.correctCount}/${session.cardsStudied} correct`
                        : "In progress"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-text-muted">{timeAgo(session.startedAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-dark">My sets</h2>
          <Link href="/sets" className="text-sm font-medium text-primary hover:underline">
            View all{recentSets.total > 0 ? ` (${recentSets.total})` : ""}
          </Link>
        </div>
        {recentSets.items.length === 0 ? (
          <EmptyState
            title="No flashcard sets yet"
            description="Create your first set to start studying."
            action={
              <Link href="/sets/create">
                <Button>Create a set</Button>
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
