import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagIcon } from "@/components/ui/icons";
import { setLanguageLabel } from "@/lib/set-language";
import { setVisibilityLabel } from "@/lib/set-visibility";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";
import type { FlashcardSet } from "@/types/flashcard";

export interface FlashcardSetCardProps {
  set: FlashcardSet;
  showVisibility?: boolean;
}

export async function FlashcardSetCard({ set, showVisibility = true }: FlashcardSetCardProps) {
  const t = createTranslator(getDictionary(await getLocale()));
  const cardsLabel =
    set.cardCount === 1 ? t("sets.cardsCount_one", { count: set.cardCount }) : t("sets.cardsCount_other", { count: set.cardCount });
  const studiedLabel =
    set.studyCount > 0
      ? ` · ${set.studyCount === 1 ? t("sets.studiedTimes_one", { count: set.studyCount }) : t("sets.studiedTimes_other", { count: set.studyCount })}`
      : "";

  return (
    <Link href={`/sets/${set.id}`} className="block h-full">
      <Card className="h-full">
        <CardBody className="flex h-full flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-1 font-semibold text-text-dark">{set.title}</h2>
            {showVisibility ? (
              <Badge variant={set.visibility === "public" ? "success" : "default"}>
                {setVisibilityLabel(set.visibility, t)}
              </Badge>
            ) : null}
          </div>
          {set.description ? <p className="line-clamp-2 text-sm text-text-muted">{set.description}</p> : null}
          <Badge variant="accent" className="flex w-fit items-center gap-1">
            <TagIcon className="h-3 w-3" />
            {setLanguageLabel(set.language, t)}
          </Badge>
          <p className="mt-auto pt-1 text-xs text-text-muted">
            {cardsLabel}
            {studiedLabel}
          </p>
        </CardBody>
      </Card>
    </Link>
  );
}
