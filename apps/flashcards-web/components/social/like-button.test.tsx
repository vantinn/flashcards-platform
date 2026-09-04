import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { LikeButton } from "./like-button";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import viDict from "@/lib/i18n/dictionaries/vi";
import { api, ApiError } from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, api: { ...actual.api, post: vi.fn(), delete: vi.fn() } };
});

function renderButton(props: { initialLiked: boolean; initialLikeCount: number }) {
  return render(
    <I18nProvider locale="vi" dict={viDict}>
      <LikeButton setId="set-1" {...props} />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  // restoreAllMocks() only rewinds vi.spyOn mocks — api.post/api.delete here
  // are plain vi.fn()s from the module factory above, so their call history
  // would otherwise leak across tests in this file; clearAllMocks() resets that.
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("LikeButton", () => {
  it("renders the initial liked state and count", () => {
    renderButton({ initialLiked: false, initialLikeCount: 5 });
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("5");
  });

  it("optimistically flips to liked and increments the count, then reconciles with the server response", async () => {
    vi.mocked(api.post).mockResolvedValue({ liked: true, likeCount: 6 });
    renderButton({ initialLiked: false, initialLikeCount: 5 });

    fireEvent.click(screen.getByRole("button"));

    // Optimistic update is immediate, before the request resolves.
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button")).toHaveTextContent("6");

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/flashcard-sets/set-1/likes");
    });
    expect(screen.getByRole("button")).toHaveTextContent("6");
  });

  it("clicking while already liked calls DELETE (unlike) and decrements the count", async () => {
    vi.mocked(api.delete).mockResolvedValue({ liked: false, likeCount: 4 });
    renderButton({ initialLiked: true, initialLikeCount: 5 });

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/flashcard-sets/set-1/likes");
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button")).toHaveTextContent("4");
  });

  it("rolls back the optimistic update and shows an error when the request fails", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(403, "This action is only available on public flashcard sets"));
    renderButton({ initialLiked: false, initialLikeCount: 5 });

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("6"); // optimistic

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent("5"); // rolled back
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("ignores a second click while a request is already in flight", async () => {
    let resolveRequest: (() => void) | undefined;
    vi.mocked(api.post).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = () => resolve({ liked: true, likeCount: 6 });
      }),
    );
    renderButton({ initialLiked: false, initialLikeCount: 5 });

    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(api.post).toHaveBeenCalledTimes(1);
    resolveRequest?.();
  });
});
