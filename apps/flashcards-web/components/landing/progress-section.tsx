import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { BrainIcon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

export async function ProgressSection() {
  const t = createTranslator(getDictionary(await getLocale()));

  return (
    <PageContainer className="py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.progressEyebrow")}</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">{t("landing.progressTitle")}</h2>
          <p className="max-w-md text-text-muted">{t("landing.progressDesc")}</p>
        </div>

        <Card className="mx-auto w-full max-w-sm" aria-hidden="true">
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BrainIcon className="h-3.5 w-3.5" />
              </span>
              <h3 className="font-semibold text-text-dark">{t("deepLearning.title")}</h3>
            </div>
            <p className="text-sm text-text-muted">{t("landing.progressMockSet")}</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{t("learning.inProgress")}</span>
                <span>58%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                <div className="h-full w-[58%] rounded-full bg-primary" />
              </div>
            </div>
            <Button className="mt-1 w-full" tabIndex={-1}>
              {t("learning.continueBtn")}
            </Button>
          </CardBody>
        </Card>
      </Reveal>
    </PageContainer>
  );
}
