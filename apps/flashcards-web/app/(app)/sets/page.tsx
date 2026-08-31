import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashcardSetCard } from "@/components/flashcards/flashcard-set-card";
import { serverApi, ApiError } from "@/lib/api-server";
import type { FlashcardSet } from "@/types/flashcard";
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
          <h1 className="text-2xl font-bold text-text-dark">My flashcard sets</h1>
          <p className="text-text-muted">Everything you&apos;ve created, in one place.</p>
        </div>
        <Link href="/sets/create">
          <Button>New set</Button>
        </Link>
      </div>

      <form action="/sets" className="flex flex-wrap gap-2">
        <SearchBar name="q" defaultValue={q} placeholder="Search my sets..." className="max-w-sm" />
        <Select name="visibility" defaultValue={visibility} className="max-w-[180px]">
          <option value="">All visibility</option>
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </Select>
        <Button type="submit">Filter</Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No sets match your filters" : "No flashcard sets yet"}
          description={hasFilters ? "Try a different search or clear your filters." : "Create your first set to start studying."}
          action={
            hasFilters ? (
              <Link href="/sets">
                <Button variant="outline">Clear filters</Button>
              </Link>
            ) : (
              <Link href="/sets/create">
                <Button>Create a set</Button>
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
                    ? "pointer-events-none rounded-card px-4 py-2 text-sm font-medium text-text-muted opacity-40"
                    : "rounded-card px-4 py-2 text-sm font-medium text-text-dark hover:bg-black/5"
                }
              >
                ← Previous
              </Link>
              <span className="text-sm text-text-muted">
                Page {page} of {totalPages}
              </span>
              <Link
                href={pageHref(page + 1)}
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages
                    ? "pointer-events-none rounded-card px-4 py-2 text-sm font-medium text-text-muted opacity-40"
                    : "rounded-card px-4 py-2 text-sm font-medium text-text-dark hover:bg-black/5"
                }
              >
                Next →
              </Link>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
