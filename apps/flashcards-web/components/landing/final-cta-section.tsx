import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";
import type { PublicUser } from "@/types/flashcard";

export interface FinalCtaSectionProps {
  user: PublicUser | null;
}

export async function FinalCtaSection({ user }: FinalCtaSectionProps) {
  const t = createTranslator(getDictionary(await getLocale()));
  const primaryHref = user ? "/sets/create" : "/register";
  const secondaryHref = user ? "/explore" : "/login?from=%2Fexplore";

  return (
    <div className="bg-surface-dark">
      <PageContainer className="py-16 sm:py-24">
        <Reveal className="flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-xl text-3xl font-bold text-white sm:text-4xl">{t("landing.finalCtaTitle")}</h2>
          <p className="max-w-md text-white/70">{t("landing.finalCtaSubtitle")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href={primaryHref}>
              <Button size="lg">{t("landing.finalCtaPrimary")}</Button>
            </Link>
            <Link href={secondaryHref}>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10"
              >
                {t("landing.finalCtaSecondary")}
              </Button>
            </Link>
          </div>
        </Reveal>
      </PageContainer>
    </div>
  );
}
