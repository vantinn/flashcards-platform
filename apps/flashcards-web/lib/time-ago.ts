import type { Translator } from "./i18n/dictionary";

export function timeAgo(iso: string, t: Translator): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return t("dashboard.justNow");
  if (minutes < 60) return t("dashboard.minutesAgo", { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("dashboard.hoursAgo", { hours });
  const days = Math.round(hours / 24);
  return t("dashboard.daysAgo", { days });
}
