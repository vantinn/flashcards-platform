import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Navbar } from "./navbar";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import viDict from "@/lib/i18n/dictionaries/vi";
import type { PublicUser } from "@/types/flashcard";

// I18nProvider calls useRouter() — see pronunciation-button.test.tsx for the
// same stub and why it's needed outside a real Next.js app.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Navbar is an async Server Component that resolves the locale via
// next/headers' cookies() (see lib/i18n/get-locale.ts) — that throws outside
// a real Next.js request scope, so it's stubbed the same way next/navigation
// is stubbed above.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const user: PublicUser = {
  id: "user-1",
  email: "test@example.com",
  displayName: "Test User",
  avatarUrl: null,
  gender: null,
  onboardingCompleted: true,
};

// Navbar is `async function Navbar(...)` — a Server Component, not a plain
// function component — so it's awaited directly to get the resolved element
// rather than rendered as JSX (React Testing Library can't run an async
// component's render pass itself).
async function renderNavbar(props: { user?: PublicUser | null }) {
  const element = await Navbar(props);
  return render(<I18nProvider locale="vi" dict={viDict}>{element}</I18nProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Navbar brand link", () => {
  it("points a signed-out visitor to the landing page, unchanged", async () => {
    await renderNavbar({ user: null });
    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveAttribute("href", "/");
  });

  it("points a signed-in user to Explore instead of the landing page", async () => {
    await renderNavbar({ user });
    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveAttribute("href", "/explore");
  });
});
