import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { ZapIcon, BrainIcon } from "@/components/ui/icons";
import { SetActions } from "@/components/flashcards/set-actions";
import { ModeProgressCard } from "@/components/learning/mode-progress-card";
import { LikeButton } from "@/components/social/like-button";
import { CommentSection } from "@/components/social/comment-section";
import { serverApi, ApiError } from "@/lib/api-server";
import { getCurrentUser } from "@/lib/current-user";
import { setLanguageLabel } from "@/lib/set-language";
import { setVisibilityLabel } from "@/lib/set-visibility";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";
import type { FlashcardSetDetail, SocialSummary, SetComment } from "@/types/flashcard";
import type { LearningSessionSummary } from "@/types/learning";
import type { PaginatedResult } from "@/types/pagination";

const COMMENTS_PAGE_SIZE = 20;

/** Social data is a non-critical enhancement (same philosophy as learningSessions below) — a hiccup here shouldn't break viewing/studying the set. */
async function loadSocial(setId: string): Promise<{ social: SocialSummary; comments: PaginatedResult<SetComment> }> {
  try {
    const [social, comments] = await Promise.all([
      serverApi.get<SocialSummary>(`/flashcard-sets/${setId}/social`),
      serverApi.get<PaginatedResult<SetComment>>(`/flashcard-sets/${setId}/comments?limit=${COMMENTS_PAGE_SIZE}`),
    ]);
    return { social, comments };
  } catch {
    return {
      social: { likeCount: 0, commentCount: 0, likedByCurrentUser: false },
      comments: { items: [], total: 0, page: 1, limit: COMMENTS_PAGE_SIZE },
    };
  }
}

async function loadSet(id: string) {
  try {
    return await serverApi.get<FlashcardSetDetail>(`/flashcard-sets/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    // Defense-in-depth: proxy.ts already blocks an anonymous request before
    // it reaches this page, but a stale-but-present cookie can still fail
    // backend auth here — send it through the same login flow rather than
    // rendering the uncaught-error page.
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/login?from=${encodeURIComponent(`/sets/${id}`)}`);
    }
    throw error;
  }
}

/** Same normalize-and-count-distinct rule the backend gates Cram/Deep Learning start on — mirrored here only to avoid showing an enabled button that the API would immediately 400 on; the API call remains the actual authority. */
function countDistinctAnswers(cards: { back: string }[]): number {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return new Set(cards.map((card) => normalize(card.back))).size;
}

export default async function SetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [set, currentUser, locale] = await Promise.all([loadSet(id), getCurrentUser(), getLocale()]);
  const t = createTranslator(getDictionary(locale));
  const isOwner = currentUser?.id === set.creator.id;
  const isPublic = set.visibility === "public";
  const { social, comments } = isPublic ? await loadSocial(set.id) : { social: null, comments: null };

  let learningSessions: LearningSessionSummary[] = [];
  if (currentUser) {
    try {
      learningSessions = await serverApi.get<LearningSessionSummary[]>(`/learning-sessions?setId=${id}`);
    } catch {
      // Non-critical enhancement — the mode cards below just show as "not started" if this fails.
      learningSessions = [];
    }
  }
  const cramSession = learningSessions.find((session) => session.mode === "cram") ?? null;
  const deepLearningSession = learningSessions.find((session) => session.mode === "deep_learning") ?? null;
  const hasEnoughDistinctAnswers = countDistinctAnswers(set.cards) >= 4;
  const ineligibleMessage = hasEnoughDistinctAnswers ? undefined : t("cram.ineligibleMessage");

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-text-dark">{set.title}</h1>
            <Badge variant={set.visibility === "public" ? "success" : "default"}>
              {setVisibilityLabel(set.visibility, t)}
            </Badge>
            <Badge variant="accent">{setLanguageLabel(set.language, t)}</Badge>
          </div>
          {set.description ? <p className="text-text-muted">{set.description}</p> : null}
          <p className="mt-1 text-sm text-text-muted">
            {t("sets.cardsByLine", {
              count: set.cardCount,
              owner: isOwner ? t("sets.byYou") : set.creator.displayName,
            })}
          </p>
        </div>

        {isOwner ? (
          <SetActions setId={set.id} setTitle={set.title} canStudy={set.cardCount > 0} />
        ) : currentUser ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href={`/sets/${set.id}/study`}>
              <Button disabled={set.cardCount === 0}>{t("sets.startStudying")}</Button>
            </Link>
          </div>
        ) : null}
      </div>

      {currentUser && set.cardCount > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModeProgressCard
            href={`/sets/${set.id}/cram`}
            icon={<ZapIcon className="h-5 w-5" />}
            title={t("cram.title")}
            description={t("cram.description")}
            eligible={hasEnoughDistinctAnswers}
            ineligibleMessage={ineligibleMessage}
            session={cramSession}
          />
          <ModeProgressCard
            href={`/sets/${set.id}/deep-learning`}
            icon={<BrainIcon className="h-5 w-5" />}
            title={t("deepLearning.title")}
            description={t("deepLearning.description")}
            eligible={hasEnoughDistinctAnswers}
            ineligibleMessage={ineligibleMessage}
            session={deepLearningSession}
          />
        </div>
      ) : null}

      {set.cards.length === 0 ? (
        <EmptyState
          title={t("sets.noCardsTitle")}
          description={isOwner ? t("sets.addFirstCardOwner") : t("sets.addFirstCardOther")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {set.cards.map((card) => (
            <Card key={card.id}>
              <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t("sets.front")}
                  </p>
                  <p className="text-text-dark">{card.front}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t("sets.back")}
                  </p>
                  <p className="text-text-dark">{card.back}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {isPublic && social && comments ? (
        <Card>
          <CardBody className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={set.creator.displayName} avatarUrl={set.creator.avatarUrl} size="lg" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t("social.ownerLabel")}</p>
                  <p className="font-semibold text-text-dark">{set.creator.displayName}</p>
                </div>
              </div>
              <LikeButton setId={set.id} initialLiked={social.likedByCurrentUser} initialLikeCount={social.likeCount} />
            </div>

            <div className="border-t border-border pt-6">
              <CommentSection setId={set.id} initialComments={comments} />
            </div>
          </CardBody>
        </Card>
      ) : null}
    </PageContainer>
  );
}
