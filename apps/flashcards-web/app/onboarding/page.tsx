import { redirect } from "next/navigation";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getCurrentUser } from "@/lib/current-user";

// Deliberately outside the (app) route group: that group's own layout
// redirects an onboarding-incomplete user *to* this page, so this page
// cannot live inside it without creating a redirect loop. proxy.ts still
// requires authentication for this route (see its matcher), and this page
// separately redirects an already-onboarded user onward — the two checks
// are mutually exclusive, so there's no cycle between them either.
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user?.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-light px-4 py-12">
      <div className="mb-8 flex w-full max-w-sm items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary">
          Flashcards
        </Link>
        <LanguageSwitcher />
      </div>
      <OnboardingFlow />
    </div>
  );
}
