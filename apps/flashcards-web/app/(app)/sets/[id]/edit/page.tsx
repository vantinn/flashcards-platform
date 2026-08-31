import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { FlashcardEditor } from "@/components/flashcards/flashcard-editor";
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

export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: setId } = await params;
  const [set, currentUser] = await Promise.all([loadSet(setId), getCurrentUser()]);

  if (!currentUser) {
    redirect(`/login?from=/sets/${setId}/edit`);
  }
  if (currentUser.id !== set.creator.id) {
    redirect(`/sets/${setId}`);
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-dark">Cards in &ldquo;{set.title}&rdquo;</h1>
          <p className="text-text-muted">Add, edit, reorder, and remove cards.</p>
        </div>
        <Link href={`/sets/${setId}`}>
          <Button variant="outline">Back to set</Button>
        </Link>
      </div>

      <FlashcardEditor setId={setId} initialCards={set.cards} />
    </PageContainer>
  );
}
