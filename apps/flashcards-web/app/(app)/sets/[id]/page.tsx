import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SetActions } from "@/components/flashcards/set-actions";
import { DuplicateSetButton } from "@/components/flashcards/duplicate-set-button";
import { serverApi, ApiError } from "@/lib/api-server";
import { getCurrentUser } from "@/lib/current-user";
import type { FlashcardSetDetail } from "@/types/flashcard";

async function loadSet(id: string) {
  try {
    return await serverApi.get<FlashcardSetDetail>(`/flashcard-sets/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

export default async function SetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [set, currentUser] = await Promise.all([loadSet(id), getCurrentUser()]);
  const isOwner = currentUser?.id === set.creator.id;

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-text-dark">{set.title}</h1>
            {isOwner ? (
              <Badge variant={set.visibility === "public" ? "success" : "default"}>{set.visibility}</Badge>
            ) : null}
            {set.category ? <Badge variant="accent">{set.category}</Badge> : null}
          </div>
          {set.description ? <p className="text-text-muted">{set.description}</p> : null}
          <p className="mt-1 text-sm text-text-muted">
            {set.cardCount} cards · by {isOwner ? "you" : set.creator.displayName}
          </p>
        </div>

        {isOwner ? (
          <SetActions setId={set.id} setTitle={set.title} canStudy={set.cardCount > 0} />
        ) : currentUser ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href={`/sets/${set.id}/study`}>
              <Button disabled={set.cardCount === 0}>Start studying</Button>
            </Link>
            <DuplicateSetButton setId={set.id} />
          </div>
        ) : null}
      </div>

      {set.cards.length === 0 ? (
        <EmptyState
          title="This set has no cards yet"
          description={isOwner ? "Add your first flashcard to get started." : "Check back later."}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {set.cards.map((card) => (
            <Card key={card.id}>
              <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Front
                  </p>
                  <p className="text-text-dark">{card.front}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Back
                  </p>
                  <p className="text-text-dark">{card.back}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
