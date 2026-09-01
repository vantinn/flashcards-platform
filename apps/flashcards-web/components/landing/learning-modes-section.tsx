import { Card, CardBody } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { BookOpenIcon, ZapIcon, BrainIcon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

export async function LearningModesSection() {
  const t = createTranslator(getDictionary(await getLocale()));

  const modes = [
    { Icon: BookOpenIcon, title: t("landing.modeDefaultTitle"), description: t("landing.modeDefaultDesc") },
    { Icon: ZapIcon, title: t("landing.modeCramTitle"), description: t("landing.modeCramDesc") },
    { Icon: BrainIcon, title: t("landing.modeDeepTitle"), description: t("landing.modeDeepDesc") },
  ];

  return (
    <PageContainer id="learning-modes" className="scroll-mt-20 py-16 sm:py-24">
      <Reveal className="flex flex-col items-center gap-4 text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.modesEyebrow")}</span>
        <h2 className="max-w-xl text-3xl font-bold text-text-dark sm:text-4xl">{t("landing.modesTitle")}</h2>
        <p className="max-w-lg text-text-muted">{t("landing.modesSubtitle")}</p>
      </Reveal>

      <Reveal className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {modes.map((mode) => (
          <Card key={mode.title}>
            <CardBody className="flex flex-col items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <mode.Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-text-dark">{mode.title}</h3>
              <p className="text-sm text-text-muted">{mode.description}</p>
            </CardBody>
          </Card>
        ))}
      </Reveal>
    </PageContainer>
  );
}
