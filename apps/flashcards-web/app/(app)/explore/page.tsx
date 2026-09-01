import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { SearchBar } from "@/components/ui/search-bar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashcardSetCard } from "@/components/flashcards/flashcard-set-card";
import { serverApi, ApiError } from "@/lib/api-server";
import type { FlashcardSet } from "@/types/flashcard";
import type { PaginatedResult } from "@/types/pagination";

const PAGE_SIZE = 12;

async function searchPublicSets(params: { q: string; category: string; page: number }) {
  const query = new URLSearchParams({
    q: params.q,
    category: params.category,
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });
  try {
    // "Public" sets are only public within the authenticated app, so this
    // must forward the caller's session like every other set-data fetch —
    // serverApi (not the plain browser api client) is what forwards cookies
    // server-side.
    return await serverApi.get<PaginatedResult<FlashcardSet>>(`/search?${query.toString()}`);
  } catch (error) {
    // Defense-in-depth: proxy.ts already blocks an anonymous request before
    // it reaches this page, but a stale-but-present cookie can still fail
    // backend auth here.
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?from=%2Fexplore");
    }
    throw error;
  }
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { q = "", category = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const result = await searchPublicSets({ q, category, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    params.set("page", String(targetPage));
    return `/explore?${params.toString()}`;
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-dark">Explore public sets</h1>
        <p className="text-text-muted">Discover flashcard sets shared by other learners.</p>
      </div>

      <form action="/explore" className="flex flex-wrap gap-2">
        <SearchBar defaultValue={q} placeholder="Search public sets..." className="max-w-sm" />
        <Input name="category" defaultValue={category} placeholder="Category" className="max-w-[180px]" />
        <Button type="submit">Search</Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="No public sets found"
          description={q || category ? "Nothing matched your filters yet." : "No public sets have been published yet."}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((set) => (
              <FlashcardSetCard key={set.id} set={set} showVisibility={false} />
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
