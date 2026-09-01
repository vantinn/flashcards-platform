import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";
import { ZapIcon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

const CHOICES = ["con mèo", "con chó", "quả táo", "cái bàn"];
const CORRECT_INDEX = 0;

export async function CramSection() {
  const t = createTranslator(getDictionary(await getLocale()));

  return (
    <PageContainer id="cram" className="scroll-mt-20 py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 mx-auto w-full max-w-sm lg:order-1" aria-hidden="true">
          <div className="rounded-card-lg border border-border bg-white p-6 shadow-card-lg sm:p-8">
            <div className="flex items-center justify-between">
              <Badge variant="accent" className="flex items-center gap-1">
                <ZapIcon className="h-3 w-3" />
                {t("cram.title")}
              </Badge>
              <span className="text-xs text-text-muted">{t("landing.cramMockQuestion")}</span>
            </div>
            <p className="mt-4 text-center text-lg font-semibold text-text-dark">cat</p>
            <div className="mt-5 grid grid-cols-1 gap-2">
              {CHOICES.map((choice, index) => (
                <div
                  key={choice}
                  className={
                    index === CORRECT_INDEX
                      ? "flex items-center gap-3 rounded-card border border-success bg-success/10 px-4 py-2.5 text-sm font-medium text-success"
                      : "flex items-center gap-3 rounded-card border border-border px-4 py-2.5 text-sm font-medium text-text-dark"
                  }
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {choice}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="order-1 flex flex-col items-start gap-4 text-left lg:order-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.cramEyebrow")}</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">{t("landing.cramTitle")}</h2>
          <p className="max-w-md text-text-muted">{t("landing.cramDesc")}</p>
        </div>
      </Reveal>
    </PageContainer>
  );
}
