import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { TagIcon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

export async function DiscoverSection() {
  const t = createTranslator(getDictionary(await getLocale()));

  const sampleSets = [
    { title: t("landing.discoverSampleSet1"), cards: 42, category: t("category.chinese") },
    { title: t("landing.discoverSampleSet2"), cards: 30, category: t("category.english") },
    { title: t("landing.discoverSampleSet3"), cards: 24, category: t("category.free") },
  ];

  return (
    <PageContainer className="py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.discoverEyebrow")}</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">{t("landing.discoverTitle")}</h2>
          <p className="max-w-md text-text-muted">{t("landing.discoverDesc")}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden="true">
          {sampleSets.map((set, index) => (
            <Card key={set.title} className={index === 2 ? "sm:col-span-2" : undefined}>
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 font-semibold text-text-dark">{set.title}</h3>
                  <Badge variant="success">{t("landing.discoverPublicBadge")}</Badge>
                </div>
                <Badge variant="accent" className="flex w-fit items-center gap-1">
                  <TagIcon className="h-3 w-3" />
                  {set.category}
                </Badge>
                <p className="mt-1 text-xs text-text-muted">{t("sets.cardsCount_other", { count: set.cards })}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Reveal>
    </PageContainer>
  );
}
