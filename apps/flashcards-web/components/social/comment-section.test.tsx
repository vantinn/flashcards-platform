import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { CommentSection } from "./comment-section";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import viDict from "@/lib/i18n/dictionaries/vi";
import { api } from "@/lib/api-client";
import type { SetComment } from "@/types/flashcard";
import type { PaginatedResult } from "@/types/pagination";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

function buildComment(overrides: Partial<SetComment> = {}): SetComment {
  return {
    id: "comment-1",
    content: "Great set!",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    author: { id: "author-1", displayName: "Alice", avatarUrl: null },
    replyCount: 0,
    canEdit: false,
    canDelete: false,
    ...overrides,
  };
}

function renderSection(initialComments: PaginatedResult<SetComment>) {
  return render(
    <I18nProvider locale="vi" dict={viDict}>
      <CommentSection setId="set-1" initialComments={initialComments} />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("CommentSection", () => {
  it("renders the empty state when there are no comments", () => {
    renderSection({ items: [], total: 0, page: 1, limit: 20 });
    expect(screen.getByText("Chưa có bình luận nào")).toBeInTheDocument();
  });

  it("renders comments already provided by the server (no fetch on initial mount)", () => {
    renderSection({ items: [buildComment()], total: 1, page: 1, limit: 20 });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Great set!")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("posts a new comment and prepends it to the list without a full refetch", async () => {
    vi.mocked(api.post).mockResolvedValue(buildComment({ id: "new-comment", content: "My new comment", canEdit: true, canDelete: true }));
    renderSection({ items: [buildComment({ id: "existing", content: "Existing comment" })], total: 1, page: 1, limit: 20 });

    fireEvent.change(screen.getByPlaceholderText("Viết bình luận..."), { target: { value: "My new comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng bình luận" }));

    await waitFor(() => {
      expect(screen.getByText("My new comment")).toBeInTheDocument();
    });
    expect(api.post).toHaveBeenCalledWith("/flashcard-sets/set-1/comments", { content: "My new comment" });
    // The pre-existing comment is still there — the new one was prepended, not a replacement.
    expect(screen.getByText("Existing comment")).toBeInTheDocument();
  });

  it("only shows Edit/Delete controls when the API says the current user is allowed to", () => {
    renderSection({
      items: [buildComment({ canEdit: true, canDelete: true }), buildComment({ id: "comment-2", canEdit: false, canDelete: false })],
      total: 2,
      page: 1,
      limit: 20,
    });

    expect(screen.getAllByText("Sửa")).toHaveLength(1);
    expect(screen.getAllByText("Xóa")).toHaveLength(1);
  });

  it("loads the next page and appends it when \"Load more\" is clicked", async () => {
    vi.mocked(api.get).mockResolvedValue({
      items: [buildComment({ id: "comment-2", content: "Second page comment" })],
      total: 2,
      page: 2,
      limit: 1,
    });
    renderSection({ items: [buildComment({ id: "comment-1" })], total: 2, page: 1, limit: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Xem thêm bình luận" }));

    await waitFor(() => {
      expect(screen.getByText("Second page comment")).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledWith("/flashcard-sets/set-1/comments?page=2&limit=1");
    // Both pages' comments are visible together.
    expect(screen.getByText("Great set!")).toBeInTheDocument();
  });

  it("removes a comment from the list when it's deleted", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);
    renderSection({
      items: [buildComment({ id: "deletable", content: "Please delete me", canEdit: true, canDelete: true })],
      total: 1,
      page: 1,
      limit: 20,
    });

    fireEvent.click(screen.getByText("Xóa"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa" })); // confirm in the dialog

    await waitFor(() => {
      expect(screen.queryByText("Please delete me")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Chưa có bình luận nào")).toBeInTheDocument();
  });
});
