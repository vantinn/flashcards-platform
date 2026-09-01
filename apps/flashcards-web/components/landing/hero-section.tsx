import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { BrainIcon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";
import type { PublicUser } from "@/types/flashcard";

export interface HeroSectionProps {
  user: PublicUser | null;
}

const MOCK_CHOICES = ["Hello", "Goodbye", "Thank you", "Please"];

export async function HeroSection({ user }: HeroSectionProps) {
  const t = createTranslator(getDictionary(await getLocale()));
  const primaryHref = user ? "/dashboard" : "/register";
  const secondaryHref = user ? "/explore" : "/login?from=%2Fexplore";

  return (
    <PageContainer className="grid grid-cols-1 items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col items-start gap-6 text-left">
        <span className="animate-fade-in rounded-full bg-primary/10 px-4 py-1 text-sm font-semibold text-primary">
          {t("landing.heroEyebrow")}
        </span>
        <h1 className="animate-fade-up text-4xl font-bold text-text-dark sm:text-5xl">{t("landing.heroTitle")}</h1>
        <p className="max-w-lg text-lg text-text-muted">{t("landing.heroSubtitle")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={primaryHref}>
            <Button size="lg">{t("landing.startLearning")}</Button>
          </Link>
          <Link href={secondaryHref}>
            <Button size="lg" variant="outline">
              {t("landing.explorePublicSets")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
        <div className="animate-float rounded-card-lg border border-border bg-white p-6 shadow-card-lg sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("landing.heroMockQuestion")}
          </span>
          {/* Intentional static demo content, not a UI label — must read
              identically in every locale, so it's a literal, not a t() key. */}
          <p className="mt-2 text-xl font-semibold text-text-dark sm:text-2xl">Xin chào</p>
          <p className="mt-1 text-sm text-text-muted">{t("landing.heroMockHint")}</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {MOCK_CHOICES.map((choice, index) => (
              <div
                key={choice}
                className="flex items-center gap-2 rounded-card border border-border px-3 py-2 text-xs font-medium text-text-dark"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                  {String.fromCharCode(65 + index)}
                </span>
                {choice}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute -bottom-6 -left-6 flex w-48 flex-col gap-2 rounded-card-lg border border-border bg-white p-4 shadow-card sm:-left-10">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{t("cram.title")}</span>
            <span>72%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full w-[72%] rounded-full bg-primary" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="accent" className="flex items-center gap-1">
              <BrainIcon className="h-3 w-3" />
              {t("deepLearning.title")}
            </Badge>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
