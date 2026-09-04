"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface TypedQuestionProps {
  back: string;
  disabled: boolean;
  onSubmit: (typedText: string) => void;
}

export function TypedQuestion({ back, disabled, onSubmit }: TypedQuestionProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col items-center gap-6">
      <div className="w-full rounded-card-lg border border-primary/30 bg-primary/5 p-8 text-center shadow-card-lg sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("learning.meaningLabel")}</p>
        <p className="mt-2 text-xl font-semibold text-text-dark sm:text-2xl">&quot;{back}&quot;</p>
        <p className="mt-3 text-sm text-text-muted">{t("learning.typedPrompt", { back })}</p>
      </div>
      <div className="flex w-full gap-2">
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder={t("learning.typedPlaceholder")}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || !value.trim()}>
          {t("learning.checkAnswer")}
        </Button>
      </div>
    </form>
  );
}
