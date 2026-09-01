import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";

const SAMPLE_SETS = [
  { title: "HSK 1 Vocabulary", cards: 42, category: "🏷 Tiếng Trung" },
  { title: "Everyday English Idioms", cards: 30, category: "🏷 Tiếng Anh" },
  { title: "World Capitals", cards: 24, category: "🏷 Tự do" },
];

export function DiscoverSection() {
  return (
    <PageContainer className="py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Learn together</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">
            Discover sets made by other learners.
          </h2>
          <p className="max-w-md text-text-muted">
            Find public flashcard sets, open them, and start learning with the same study
            experiences available for your own sets. Only the original creator can edit or delete
            a set — everyone else just gets to learn from it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden="true">
          {SAMPLE_SETS.map((set) => (
            <Card key={set.title} className={set === SAMPLE_SETS[2] ? "sm:col-span-2" : undefined}>
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 font-semibold text-text-dark">{set.title}</h3>
                  <Badge variant="success">public</Badge>
                </div>
                <Badge variant="accent" className="w-fit">
                  {set.category}
                </Badge>
                <p className="mt-1 text-xs text-text-muted">{set.cards} cards</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Reveal>
    </PageContainer>
  );
}
