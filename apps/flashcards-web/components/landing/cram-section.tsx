import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { Reveal } from "@/components/landing/reveal";

const CHOICES = ["con mèo", "con chó", "quả táo", "cái bàn"];
const CORRECT_INDEX = 0;

export function CramSection() {
  return (
    <PageContainer id="cram" className="scroll-mt-20 py-16 sm:py-24">
      <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 mx-auto w-full max-w-sm lg:order-1" aria-hidden="true">
          <div className="rounded-card-lg border border-border bg-white p-6 shadow-card-lg sm:p-8">
            <div className="flex items-center justify-between">
              <Badge variant="accent">⚡ Học nhồi nhét</Badge>
              <span className="text-xs text-text-muted">Câu 6/10</span>
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
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Học nhồi nhét</span>
          <h2 className="text-3xl font-bold text-text-dark sm:text-4xl">
            Practice fast when the exam is coming.
          </h2>
          <p className="max-w-md text-text-muted">
            Every question gives you four choices with exactly one correct answer. Get one wrong
            and it comes back around later in the set instead of right away, so you keep moving
            while still closing the gaps. Pick up where you left off any time, and watch your
            progress climb toward 100%.
          </p>
        </div>
      </Reveal>
    </PageContainer>
  );
}
