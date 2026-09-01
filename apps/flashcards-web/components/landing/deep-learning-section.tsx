import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";

const STEPS = [
  { label: "Meaning", detail: "con mèo" },
  { label: "Multiple choice", detail: "Pick the right word" },
  { label: "Typed recall", detail: "Type the word yourself" },
  { label: "Progress", detail: "Card completed" },
];

export function DeepLearningSection() {
  return (
    <PageContainer id="deep-learning" className="scroll-mt-20 py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Học nhớ sâu</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">
            Don&apos;t just recognize the answer. Recall it.
          </h2>
          <p className="max-w-md text-text-muted">
            Deep Learning starts each card with a multiple-choice check, then asks you to type
            the answer yourself once you&apos;ve shown you recognize it. Typing it out means
            actively recalling it, not just picking it out of a list — practice active recall and
            reinforce what you learn, one card at a time.
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm" aria-hidden="true">
          <div className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
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
                {index === STEPS.length - 1 ? <Badge variant="success">✓</Badge> : null}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </PageContainer>
  );
}
