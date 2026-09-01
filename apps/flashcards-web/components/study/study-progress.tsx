"use client";

import { useI18n } from "@/lib/i18n/i18n-context";

export interface StudyProgressProps {
  current: number;
  total: number;
}

export function StudyProgress({ current, total }: StudyProgressProps) {
  const { t } = useI18n();
  const percent = total === 0 ? 0 : Math.round((current / total) * 100);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>{t("study.cardXOfY", { current: Math.min(current + 1, total), total })}</span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-black/5"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
