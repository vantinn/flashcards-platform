import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZapIcon } from "@/components/ui/icons";
import { LearningPlayer } from "@/components/learning/learning-player";
import { serverApi, ApiError } from "@/lib/api-server";
import { speechLangFor } from "@/lib/set-language";
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
    // Defense-in-depth: proxy.ts already blocks an anonymous request before
    // it reaches this page, but a stale-but-present cookie can still fail
    // backend auth here — send it through the same login flow rather than
    // rendering the uncaught-error page.
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/login?from=${encodeURIComponent(`/sets/${id}/cram`)}`);
    }
    throw error;
  }
}

export default async function CramSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [set, locale] = await Promise.all([loadSet(id), getLocale()]);
  const t = createTranslator(getDictionary(locale));

  if (set.cards.length === 0) {
    return (
      <PageContainer className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{set.title}</p>
            <h1 className="text-xl font-bold text-text-dark">{t("cram.noCardsTitle")}</h1>
            <p className="text-sm text-text-muted">{t("cram.noCardsDesc")}</p>
            <Link href={`/sets/${set.id}`}>
              <Button variant="outline">{t("study.backToSet")}</Button>
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
        icon={<ZapIcon className="h-4 w-4" />}
        title={t("cram.title")}
        completionMessage={t("cram.completionMessage")}
        language={speechLangFor(set.language)}
      />
    </PageContainer>
  );
}
