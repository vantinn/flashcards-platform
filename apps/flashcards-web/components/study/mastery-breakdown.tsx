export interface MasteryBreakdownProps {
  learningCount: number;
  masteredCount: number;
}

// Sourced from GET /progress/summary — a server-computed aggregate, not a
// raw progress list counted client-side. Only Learning/Mastered are shown:
// a StudyProgress row is only ever created on a card's first answer (see
// ProgressService.recordAnswers), so "new" never actually appears in this
// table — showing a segment that's always 0 would just be visual noise.
export function MasteryBreakdown({ learningCount, masteredCount }: MasteryBreakdownProps) {
  const total = learningCount + masteredCount;
  const learningPercent = total === 0 ? 0 : (learningCount / total) * 100;
  const masteredPercent = total === 0 ? 0 : (masteredCount / total) * 100;

  return (
    <div className="flex flex-col gap-3 rounded-card-lg border border-border bg-white p-5 shadow-card">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/5">
        {learningPercent > 0 ? <div className="bg-primary" style={{ width: `${learningPercent}%` }} /> : null}
        {masteredPercent > 0 ? <div className="bg-success" style={{ width: `${masteredPercent}%` }} /> : null}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-primary">Learning</span>
          <span className="text-text-muted">{learningCount}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-success">Mastered</span>
          <span className="text-text-muted">{masteredCount}</span>
        </span>
      </div>
    </div>
  );
}
