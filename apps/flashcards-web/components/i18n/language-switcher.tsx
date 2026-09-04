"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/locale";

const OPTIONS: { value: Locale; labelKey: "languageSwitcher.vietnamese" | "languageSwitcher.english" }[] = [
  { value: "vi", labelKey: "languageSwitcher.vietnamese" },
  { value: "en", labelKey: "languageSwitcher.english" },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("languageSwitcher.label")}
      className={cn("inline-flex items-center gap-1 rounded-card bg-black/5 p-1 text-sm", className)}
    >
      {OPTIONS.map((option) => {
        const active = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(option.value)}
            className={cn(
              "rounded-card px-2.5 py-1 font-medium transition-colors",
              active ? "bg-white text-text-dark shadow-card" : "text-text-muted hover:text-text-dark",
            )}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
