import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";

export function ProgressSection() {
  return (
    <PageContainer className="py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-4 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Keep learning</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">
            Your learning continues where you left off.
          </h2>
          <p className="max-w-md text-text-muted">
            Every study mode tracks your own progress on every set — separately from anyone else
            studying the same set. Come back anytime and pick up exactly where you stopped.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-sm" aria-hidden="true">
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">
                🧠
              </span>
              <h3 className="font-semibold text-text-dark">Học nhớ sâu</h3>
            </div>
            <p className="text-sm text-text-muted">HSK 1 Vocabulary</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Đang học</span>
                <span>58%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                <div className="h-full w-[58%] rounded-full bg-primary" />
              </div>
            </div>
            <Button className="mt-1 w-full" tabIndex={-1}>
              Tiếp tục
            </Button>
          </CardBody>
        </Card>
      </Reveal>
    </PageContainer>
  );
}
