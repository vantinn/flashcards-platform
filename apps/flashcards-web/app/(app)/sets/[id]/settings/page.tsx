import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { EditSetForm } from "@/components/flashcards/edit-set-form";
import { serverApi, ApiError } from "@/lib/api-server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";
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

export default async function EditSetSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: setId } = await params;
  const [set, currentUser, locale] = await Promise.all([loadSet(setId), getCurrentUser(), getLocale()]);
  const t = createTranslator(getDictionary(locale));

  if (!currentUser) {
    redirect(`/login?from=/sets/${setId}/settings`);
  }
  if (currentUser.id !== set.creator.id) {
    redirect(`/sets/${setId}`);
  }

  return (
    <PageContainer className="max-w-xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-dark">{t("sets.editSetTitle", { title: set.title })}</h1>
        <Link href={`/sets/${setId}`}>
          <Button variant="outline">{t("sets.backToSet")}</Button>
        </Link>
      </div>

      <EditSetForm set={set} />
    </PageContainer>
  );
}
