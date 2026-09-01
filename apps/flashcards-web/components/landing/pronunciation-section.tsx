import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

export async function PronunciationSection() {
  const t = createTranslator(getDictionary(await getLocale()));

  return (
    <PageContainer className="py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="mx-auto w-full max-w-sm" aria-hidden="true">
          <div className="flex items-center justify-center gap-3 rounded-card-lg border border-border bg-white p-8 shadow-card-lg sm:p-12">
            <span className="text-2xl font-semibold text-text-dark">你好</span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5 6 9H2v6h4l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"
                />
              </svg>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.pronunciationEyebrow")}</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">{t("landing.pronunciationTitle")}</h2>
          <p className="max-w-md text-text-muted">{t("landing.pronunciationDesc")}</p>
        </div>
      </Reveal>
    </PageContainer>
  );
}
