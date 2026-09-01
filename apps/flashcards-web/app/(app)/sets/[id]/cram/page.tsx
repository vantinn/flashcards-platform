import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearningPlayer } from "@/components/learning/learning-player";
import { serverApi, ApiError } from "@/lib/api-server";
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

export default async function CramSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const set = await loadSet(id);

  if (set.cards.length === 0) {
    return (
      <PageContainer className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{set.title}</p>
            <h1 className="text-xl font-bold text-text-dark">This set has no cards yet</h1>
            <p className="text-sm text-text-muted">Add a few cards before starting Học nhồi nhét.</p>
            <Link href={`/sets/${set.id}`}>
              <Button variant="outline">Back to set</Button>
            </Link>
          </CardBody>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-1 flex-col">
      <LearningPlayer
        setId={set.id}
        setTitle={set.title}
        mode="cram"
        icon="⚡"
        title="Học nhồi nhét"
        completionMessage="Bạn đã hoàn thành chế độ Học nhồi nhét cho bộ thẻ này."
      />
    </PageContainer>
  );
}
