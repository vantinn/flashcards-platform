"use client";

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface OtpInputProps {
  length?: number;
  onChange: (code: string) => void;
  disabled?: boolean;
  label: string;
}

/**
 * A 6-box OTP entry field. Digits are kept as an array of one-character
 * slots (index = box position) rather than a single string — a plain
 * string can't represent "box 3 filled, boxes 0-2 still empty" (nothing to
 * concatenate at the empty positions), which matters because a user can
 * click straight into any box, not just type left-to-right. `onChange`
 * reports the joined code purely for the caller's convenience (submit-button
 * gating, request body); by the time every slot is filled — the only case
 * that matters for submission — join order always matches box order
 * regardless of the order the boxes were actually filled in.
 *
 * Give this component a fresh `key` from the parent (e.g. bump a counter
 * after a rejected code) to clear it for a retry.
 */
export function OtpInput({ length = 6, onChange, disabled, label }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function commit(next: string[]) {
    setDigits(next);
    onChange(next.join(""));
  }

  function fillFrom(startIndex: number, characters: string) {
    const next = [...digits];
    let cursor = startIndex;
    for (const character of characters) {
      if (cursor >= length) break;
      next[cursor] = character;
      cursor += 1;
    }
    commit(next);
    inputRefs.current[Math.min(cursor, length - 1)]?.focus();
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/\D/g, "");
    if (!digitsOnly) {
      const next = [...digits];
      next[index] = "";
      commit(next);
      return;
    }
    fillFrom(index, digitsOnly);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        commit(next);
        return;
      }
      if (index > 0) {
        event.preventDefault();
        const next = [...digits];
        next[index - 1] = "";
        commit(next);
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    fillFrom(index, pasted);
  }

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${length}`}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
          className={cn(
            "h-12 w-11 rounded-card border border-border bg-white text-center text-lg font-semibold text-text-dark transition",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40",
            "disabled:opacity-50 sm:h-14 sm:w-12",
          )}
        />
      ))}
    </div>
  );
}
