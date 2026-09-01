import { Card, CardBody } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";

const MODES = [
  {
    icon: "🃏",
    title: "Học mặc định",
    description:
      "Flip through cards at your own pace. Reveal the answer, move forward, or return to the previous card.",
  },
  {
    icon: "⚡",
    title: "Học nhồi nhét",
    description:
      "Practice with multiple-choice questions and move quickly through a set when you need to prepare in a short amount of time.",
  },
  {
    icon: "🧠",
    title: "Học nhớ sâu",
    description:
      "Combine multiple-choice practice with typed recall to actively retrieve what you have learned.",
  },
];

export function LearningModesSection() {
  return (
    <PageContainer id="learning-modes" className="scroll-mt-20 py-16 sm:py-24">
      <Reveal className="flex flex-col items-center gap-4 text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-primary">Learn your way</span>
        <h2 className="max-w-xl text-3xl font-bold text-text-dark sm:text-4xl">
          Choose the way you want to learn.
        </h2>
        <p className="max-w-lg text-text-muted">
          Every set you create — or find — can be studied three different ways, so you can match
          the mode to how much time you have and how well you already know it.
        </p>
      </Reveal>

      <Reveal className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {MODES.map((mode) => (
          <Card key={mode.title}>
            <CardBody className="flex flex-col items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                {mode.icon}
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
