import { Card, CardBody } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

const SAMPLE_CARDS = [
  { front: "Gracias", back: "Thank you" },
  { front: "Buenos días", back: "Good morning" },
  { front: "Por favor", back: "Please" },
];

export async function CreateSection() {
  const t = createTranslator(getDictionary(await getLocale()));

  return (
    <PageContainer className="py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("landing.createEyebrow")}
          </span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">{t("landing.createTitle")}</h2>
          <p className="max-w-md text-text-muted">{t("landing.createSubtitle")}</p>
        </div>

        <Card className="mx-auto w-full max-w-md">
          <CardBody className="flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-text-dark">{t("landing.createSampleTitle")}</h3>
              <p className="text-sm text-text-muted">{t("landing.createSampleSubtitle")}</p>
            </div>
            <div className="flex flex-col gap-2">
              {SAMPLE_CARDS.map((card) => (
                <div
                  key={card.front}
                  className="grid grid-cols-2 gap-3 rounded-card border border-border px-4 py-3 text-sm"
                >
                  <span className="font-medium text-text-dark">{card.front}</span>
                  <span className="text-text-muted">{card.back}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-medium text-text-muted">
              {t("sets.cardsCount_other", { count: SAMPLE_CARDS.length })} · {t("category.free")}
            </p>
          </CardBody>
        </Card>
      </Reveal>
    </PageContainer>
  );
}
