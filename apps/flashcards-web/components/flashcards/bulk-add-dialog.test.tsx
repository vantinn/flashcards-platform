import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { BulkAddDialog } from "./bulk-add-dialog";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import viDict from "@/lib/i18n/dictionaries/vi";
import { api, ApiError } from "@/lib/api-client";
import type { Flashcard } from "@/types/flashcard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

function buildCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    front: "existing",
    back: "card",
    frontImageUrl: null,
    backImageUrl: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderDialog(props: Partial<React.ComponentProps<typeof BulkAddDialog>> = {}) {
  const onClose = vi.fn();
  const onImported = vi.fn();
  const utils = render(
    <I18nProvider locale="vi" dict={viDict}>
      <BulkAddDialog open setId="set-1" existingCards={[]} onClose={onClose} onImported={onImported} {...props} />
    </I18nProvider>,
  );
  return { ...utils, onClose, onImported };
}

function paste(text: string) {
  fireEvent.change(screen.getByLabelText("Dán dữ liệu vào đây"), { target: { value: text } });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("BulkAddDialog", () => {
  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Hướng dẫn")).not.toBeInTheDocument();
  });

  it("shows the instructions and a visual example before any data is pasted", () => {
    renderDialog();
    expect(screen.getByText("Hướng dẫn")).toBeInTheDocument();
    expect(screen.getByText(/sao chép dữ liệu gồm 2 cột/)).toBeInTheDocument();
    // The example table.
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("xin chào")).toBeInTheDocument();
  });

  it("has a properly labeled textarea, not just a placeholder", () => {
    renderDialog();
    expect(screen.getByLabelText("Dán dữ liệu vào đây")).toBeInTheDocument();
  });

  it("shows no preview table before anything is pasted, and disables the import button", () => {
    renderDialog();
    expect(screen.queryByText(/Phát hiện/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm các thẻ hợp lệ/ })).toBeDisabled();
  });

  it("parses pasted data into a live preview with correct valid/invalid/duplicate rows", () => {
    renderDialog();
    paste("hello\txin chào\nworld\tthế giới\nmissing-back\t\ninvalid-line");

    expect(screen.getByText("Phát hiện 4 dòng")).toBeInTheDocument();
    expect(screen.getByText("2 hợp lệ")).toBeInTheDocument();
    expect(screen.getByText("2 không hợp lệ")).toBeInTheDocument();
    expect(screen.getAllByText("Hợp lệ")).toHaveLength(2);
    expect(screen.getAllByText("Không hợp lệ")).toHaveLength(2);
  });

  it("flags a row that duplicates an existing card in the set", () => {
    renderDialog({ existingCards: [buildCard({ front: "hello", back: "xin chào" })] });
    paste("hello\txin chào");

    expect(screen.getByText("1 trùng")).toBeInTheDocument();
    expect(screen.getByText("Trùng")).toBeInTheDocument();
  });

  it("enables the import button with the correct valid-row count once valid rows exist", () => {
    renderDialog();
    paste("hello\txin chào\nworld\tthế giới");

    const importButton = screen.getByRole("button", { name: "Thêm các thẻ hợp lệ (2)" });
    expect(importButton).toBeEnabled();
  });

  it("submits only the valid rows to the bulk endpoint and shows a loading state while in flight", async () => {
    let resolveRequest: (() => void) | undefined;
    vi.mocked(api.post).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = () => resolve({ cards: [], totalReceived: 1, importedCount: 1, duplicateCount: 0 });
      }),
    );
    renderDialog();
    paste("hello\txin chào\ninvalid-line");

    fireEvent.click(screen.getByRole("button", { name: "Thêm các thẻ hợp lệ (1)" }));

    expect(await screen.findByRole("button", { name: "Đang thêm..." })).toBeDisabled();
    expect(api.post).toHaveBeenCalledWith("/flashcard-sets/set-1/cards/bulk", {
      cards: [{ front: "hello", back: "xin chào" }],
    });
    resolveRequest?.();
  });

  it("shows a full result summary and calls onImported after a successful import", async () => {
    const importedCard = buildCard({ id: "new-1", front: "hello", back: "xin chào" });
    vi.mocked(api.post).mockResolvedValue({
      cards: [importedCard],
      totalReceived: 1,
      importedCount: 1,
      duplicateCount: 0,
    });
    const { onImported } = renderDialog();
    paste("hello\txin chào\ninvalid-line");

    fireEvent.click(screen.getByRole("button", { name: "Thêm các thẻ hợp lệ (1)" }));

    expect(await screen.findByText("Đã thêm 1 thẻ")).toBeInTheDocument();
    // totalParsed (2, including the invalid line) vs. backend importedCount (1).
    expect(screen.getByText("2")).toBeInTheDocument();
    await waitFor(() => expect(onImported).toHaveBeenCalledWith([importedCard]));
  });

  it("shows a safe error message and keeps the dialog on the input step when the API call fails", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(403, "This action is only available on public flashcard sets"));
    renderDialog();
    paste("hello\txin chào");

    fireEvent.click(screen.getByRole("button", { name: "Thêm các thẻ hợp lệ (1)" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Still on the paste/preview step, not the result step.
    expect(screen.getByLabelText("Dán dữ liệu vào đây")).toBeInTheDocument();
  });

  it("closing and reopening (via onClose then a fresh render with open) starts from a clean slate", () => {
    const { rerender, onClose } = renderDialog();
    paste("hello\txin chào");
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onClose).toHaveBeenCalled();

    rerender(
      <I18nProvider locale="vi" dict={viDict}>
        <BulkAddDialog open={false} setId="set-1" existingCards={[]} onClose={vi.fn()} onImported={vi.fn()} />
      </I18nProvider>,
    );
    rerender(
      <I18nProvider locale="vi" dict={viDict}>
        <BulkAddDialog open setId="set-1" existingCards={[]} onClose={vi.fn()} onImported={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByLabelText("Dán dữ liệu vào đây")).toHaveValue("");
  });
});
