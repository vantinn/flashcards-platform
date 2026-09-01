import { Card, CardBody } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";

const SAMPLE_CARDS = [
  { front: "Gracias", back: "Thank you" },
  { front: "Buenos días", back: "Good morning" },
  { front: "Por favor", back: "Please" },
];

export function CreateSection() {
  return (
    <PageContainer className="py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">
            Create &amp; organize
          </span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">
            Turn what you need to learn into flashcards.
          </h2>
          <p className="max-w-md text-text-muted">
            Create your own flashcard sets and organize the knowledge you want to remember. Give
            each set a title, description, and category, keep everything in one place, and learn
            at your own pace.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-md">
          <CardBody className="flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-text-dark">Spanish Basics</h3>
              <p className="text-sm text-text-muted">Common greetings and everyday phrases</p>
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
            <p className="text-xs font-medium text-text-muted">{SAMPLE_CARDS.length} cards · Free</p>
          </CardBody>
        </Card>
      </Reveal>
    </PageContainer>
  );
}
