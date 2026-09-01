import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/icons";
import { FlashcardSetCard } from "@/components/flashcards/flashcard-set-card";
import { serverApi, ApiError } from "@/lib/api-server";
import { SET_VISIBILITIES, setVisibilityLabel } from "@/lib/set-visibility";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";
import type { FlashcardSet, SetVisibility } from "@/types/flashcard";
import type { PaginatedResult } from "@/types/pagination";

const PAGE_SIZE = 12;

async function loadMySets(params: { q: string; visibility: string; page: number }) {
  const query = new URLSearchParams({ page: String(params.page), limit: String(PAGE_SIZE) });
  if (params.q) query.set("q", params.q);
  if (params.visibility) query.set("visibility", params.visibility);

  try {
    return await serverApi.get<PaginatedResult<FlashcardSet>>(`/flashcard-sets?${query.toString()}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
}

export default async function MySetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; visibility?: string; page?: string }>;
}) {
  const { q = "", visibility = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const t = createTranslator(getDictionary(await getLocale()));

  const result = await loadMySets({ q, visibility, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  const hasFilters = Boolean(q || visibility);

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (visibility) params.set("visibility", visibility);
    params.set("page", String(targetPage));
    return `/sets?${params.toString()}`;
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-dark">{t("sets.myTitle")}</h1>
          <p className="text-text-muted">{t("sets.mySubtitle")}</p>
        </div>
        <Link href="/sets/create">
          <Button>{t("sets.newSet")}</Button>
        </Link>
      </div>

      <form action="/sets" className="flex flex-wrap gap-2">
        <SearchBar name="q" defaultValue={q} placeholder={t("sets.searchPlaceholder")} className="max-w-sm" />
        <Select name="visibility" defaultValue={visibility} className="max-w-[180px]">
          <option value="">{t("visibility.allVisibility")}</option>
          {SET_VISIBILITIES.map((value: SetVisibility) => (
            <option key={value} value={value}>
              {setVisibilityLabel(value, t)}
            </option>
          ))}
        </Select>
        <Button type="submit">{t("sets.filter")}</Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? t("sets.noSetsFilterTitle") : t("sets.noSetsTitle")}
          description={hasFilters ? t("sets.noSetsFilterDesc") : t("sets.noSetsDesc")}
          action={
            hasFilters ? (
              <Link href="/sets">
                <Button variant="outline">{t("sets.clearFilters")}</Button>
              </Link>
            ) : (
              <Link href="/sets/create">
                <Button>{t("sets.createASet")}</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((set) => (
              <FlashcardSetCard key={set.id} set={set} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-4">
              <Link
                href={pageHref(page - 1)}
                aria-disabled={page <= 1}
                className={
                  page <= 1
                    ? "pointer-events-none flex items-center gap-1 rounded-card px-4 py-2 text-sm font-medium text-text-muted opacity-40"
                    : "flex items-center gap-1 rounded-card px-4 py-2 text-sm font-medium text-text-dark hover:bg-black/5"
                }
              >
                <ArrowLeftIcon className="h-4 w-4" />
                {t("common.previous")}
              </Link>
              <span className="text-sm text-text-muted">{t("sets.pageOf", { page, total: totalPages })}</span>
              <Link
                href={pageHref(page + 1)}
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages
                    ? "pointer-events-none flex items-center gap-1 rounded-card px-4 py-2 text-sm font-medium text-text-muted opacity-40"
                    : "flex items-center gap-1 rounded-card px-4 py-2 text-sm font-medium text-text-dark hover:bg-black/5"
                }
              >
                {t("common.next")}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
