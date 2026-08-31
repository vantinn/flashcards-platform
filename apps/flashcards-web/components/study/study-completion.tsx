import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface StudyCompletionProps {
  setId: string;
  setTitle: string;
  correctCount: number;
  incorrectCount: number;
  onRestart: () => void;
}

export function StudyCompletion({ setId, setTitle, correctCount, incorrectCount, onRestart }: StudyCompletionProps) {
  const total = correctCount + incorrectCount;
  const percent = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  return (
    <Card className="w-full max-w-md animate-fade-up">
      <CardBody className="flex flex-col items-center gap-5 py-10 text-center">
        <span className="text-4xl">🎉</span>
        <div>
          <h1 className="text-xl font-bold text-text-dark">Session complete!</h1>
          <p className="text-sm text-text-muted">{setTitle}</p>
        </div>

        <div className="flex w-full items-center justify-center gap-8">
          <div>
            <p className="text-3xl font-bold text-success">{correctCount}</p>
            <p className="text-xs text-text-muted">Recalled</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-danger">{incorrectCount}</p>
            <p className="text-xs text-text-muted">Again</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary">{percent}%</p>
            <p className="text-xs text-text-muted">Accuracy</p>
          </div>
        </div>

        <div className="flex w-full gap-2">
          <Button variant="outline" className="flex-1" onClick={onRestart}>
            Study again
          </Button>
          <Link href={`/sets/${setId}`} className="flex-1">
            <Button className="w-full">Back to set</Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
