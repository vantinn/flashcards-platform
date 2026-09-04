import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";
import type { LearningSessionSummary } from "@/types/learning";

export interface ModeProgressCardProps {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  eligible: boolean;
  ineligibleMessage?: string;
  session: LearningSessionSummary | null;
}

export async function ModeProgressCard({
  href,
  icon,
  title,
  description,
  eligible,
  ineligibleMessage,
  session,
}: ModeProgressCardProps) {
  const t = createTranslator(getDictionary(await getLocale()));
  const completed = session?.status === "completed";

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h3 className="font-semibold text-text-dark">{title}</h3>
        </div>
        <p className="text-sm text-text-muted">{description}</p>

        {!eligible ? (
          <>
            <Button disabled className="mt-1 w-full">
              {title}
            </Button>
            {ineligibleMessage ? <p className="text-xs text-text-muted">{ineligibleMessage}</p> : null}
          </>
        ) : (
          <>
            {session ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{completed ? t("learning.completed") : t("learning.inProgress")}</span>
                  <span>{session.progress.percent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      completed ? "bg-success" : "bg-primary",
                    )}
                    style={{ width: `${session.progress.percent}%` }}
                  />
                </div>
              </div>
            ) : null}

            {completed ? (
              <Button disabled variant="outline" className="mt-1 w-full">
                {t("learning.fullyCompleted")}
              </Button>
            ) : (
              <Link href={href} className="mt-1">
                <Button className="w-full">{session ? t("learning.continueBtn") : t("learning.startBtn")}</Button>
              </Link>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
