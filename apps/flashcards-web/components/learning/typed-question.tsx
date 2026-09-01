"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface TypedQuestionProps {
  back: string;
  disabled: boolean;
  onSubmit: (typedText: string) => void;
}

export function TypedQuestion({ back, disabled, onSubmit }: TypedQuestionProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col items-center gap-6">
      <div className="w-full rounded-card-lg border border-primary/30 bg-primary/5 p-8 text-center shadow-card-lg sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Nghĩa</p>
        <p className="mt-2 text-xl font-semibold text-text-dark sm:text-2xl">&quot;{back}&quot;</p>
        <p className="mt-3 text-sm text-text-muted">Từ tiếng Anh nào có nghĩa là &quot;{back}&quot;?</p>
      </div>
      <div className="flex w-full gap-2">
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder="Nhập câu trả lời..."
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || !value.trim()}>
          Kiểm tra
        </Button>
      </div>
    </form>
  );
}
