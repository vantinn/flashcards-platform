import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingFlow } from "./onboarding-flow";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import viDict from "@/lib/i18n/dictionaries/vi";
import enDict from "@/lib/i18n/dictionaries/en";
import { api, ApiError } from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, api: { ...actual.api, patch: vi.fn() } };
});

function renderFlow(locale: "vi" | "en" = "vi") {
  const dict = locale === "vi" ? viDict : enDict;
  return render(
    <I18nProvider locale={locale} dict={dict}>
      <OnboardingFlow />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OnboardingFlow", () => {
  it("disables Continue until a gender is selected, in Vietnamese", () => {
    renderFlow("vi");
    expect(screen.getByRole("heading", { name: "Chọn giới tính" })).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Tiếp tục" });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Nam" }));
    expect(continueButton).toBeEnabled();
  });

  it("renders in English when given the English dictionary", () => {
    renderFlow("en");
    expect(screen.getByRole("heading", { name: "Choose your gender" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Male" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Female" })).toBeInTheDocument();
  });

  it("moves to the avatar step only after a gender is chosen, and lets Skip complete onboarding with no avatar", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    renderFlow("vi");

    fireEvent.click(screen.getByRole("radio", { name: "Nữ" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    expect(await screen.findByRole("heading", { name: "Chọn ảnh đại diện" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/users/me/onboarding", { gender: "female", avatar: undefined });
    });
  });

  it("sends the selected avatar identifier when finishing with one chosen", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    renderFlow("vi");

    fireEvent.click(screen.getByRole("radio", { name: "Nam" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await screen.findByRole("heading", { name: "Chọn ảnh đại diện" });

    const avatarRadios = screen.getAllByRole("radio");
    fireEvent.click(avatarRadios[0]);
    expect(avatarRadios[0]).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Hoàn tất" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/users/me/onboarding", { gender: "male", avatar: "1.png" });
    });
  });

  it("shows an error and stays on the avatar step if saving fails, without marking anything done", async () => {
    vi.mocked(api.patch).mockRejectedValue(new ApiError(500, "Something went wrong"));
    renderFlow("vi");

    fireEvent.click(screen.getByRole("radio", { name: "Nam" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await screen.findByRole("heading", { name: "Chọn ảnh đại diện" });

    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Still on the avatar step — not silently advanced past a failed save.
    expect(screen.getByRole("heading", { name: "Chọn ảnh đại diện" })).toBeInTheDocument();
  });

  it("disables the finish/skip buttons while a save is in flight, to prevent duplicate submissions", async () => {
    let resolveSave: (() => void) | undefined;
    vi.mocked(api.patch).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = () => resolve({});
      }),
    );
    renderFlow("vi");

    fireEvent.click(screen.getByRole("radio", { name: "Nam" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await screen.findByRole("heading", { name: "Chọn ảnh đại diện" });

    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));

    expect(await screen.findByRole("button", { name: "Đang lưu..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bỏ qua" })).toBeDisabled();

    resolveSave?.();
  });
});
