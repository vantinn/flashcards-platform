import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SET_LANGUAGE_LABELS } from "@/lib/set-language";
import type { FlashcardSet } from "@/types/flashcard";

export interface FlashcardSetCardProps {
  set: FlashcardSet;
  showVisibility?: boolean;
}

export function FlashcardSetCard({ set, showVisibility = true }: FlashcardSetCardProps) {
  return (
    <Link href={`/sets/${set.id}`} className="block h-full">
      <Card className="h-full">
        <CardBody className="flex h-full flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-1 font-semibold text-text-dark">{set.title}</h2>
            {showVisibility ? (
              <Badge variant={set.visibility === "public" ? "success" : "default"}>{set.visibility}</Badge>
            ) : null}
          </div>
          {set.description ? <p className="line-clamp-2 text-sm text-text-muted">{set.description}</p> : null}
          <Badge variant="accent" className="w-fit">
            🏷 {SET_LANGUAGE_LABELS[set.language]}
          </Badge>
          <p className="mt-auto pt-1 text-xs text-text-muted">
            {set.cardCount} card{set.cardCount === 1 ? "" : "s"}
            {set.studyCount > 0 ? ` · studied ${set.studyCount} time${set.studyCount === 1 ? "" : "s"}` : ""}
          </p>
        </CardBody>
      </Card>
    </Link>
  );
}
