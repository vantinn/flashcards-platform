import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { CheckCircleIcon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

export async function DeepLearningSection() {
  const t = createTranslator(getDictionary(await getLocale()));

  const steps = [
    { label: t("landing.deepStepMeaning"), detail: t("landing.deepStepMeaningDetail") },
    { label: t("landing.deepStepMc"), detail: t("landing.deepStepMcDetail") },
    { label: t("landing.deepStepTyped"), detail: t("landing.deepStepTypedDetail") },
    { label: t("landing.deepStepProgress"), detail: t("landing.deepStepProgressDetail") },
  ];

  return (
    <PageContainer id="deep-learning" className="scroll-mt-20 py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.deepEyebrow")}</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">{t("landing.deepTitle")}</h2>
          <p className="max-w-md text-text-muted">{t("landing.deepDesc")}</p>
        </div>

        <div className="mx-auto w-full max-w-sm" aria-hidden="true">
          <div className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <div
                key={step.label}
                className="flex items-center gap-4 rounded-card-lg border border-border bg-white p-4 shadow-card"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-dark">{step.label}</span>
                  <span className="text-xs text-text-muted">{step.detail}</span>
                </div>
                {index === steps.length - 1 ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircleIcon className="h-3 w-3" />
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </PageContainer>
  );
}
