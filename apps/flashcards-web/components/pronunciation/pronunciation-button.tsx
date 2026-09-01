"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { usePronunciation } from "./use-pronunciation";

export interface PronunciationButtonProps {
  /** Text to speak — always the target-language term (e.g. a card's front), never the translation. */
  text: string;
  /** BCP-47 tag (e.g. "en-US"/"zh-CN"), or null for a Free-category set — renders nothing when null. */
  language: string | null;
  /** Icon-only, for secondary/inline placements (e.g. next to a revealed answer). */
  compact?: boolean;
  className?: string;
}

export function PronunciationButton({ text, language, compact, className }: PronunciationButtonProps) {
  const { isSupported, speak, cancel } = usePronunciation();

  // Cancels stale speech whenever the identity of what this button speaks
  // changes (a new card's text/language) — this fires on prop change as
  // well as unmount, so navigating Next/Previous never leaves audio playing
  // for a card that's no longer on screen.
  useEffect(() => {
    return () => cancel();
  }, [text, language, cancel]);

  if (!language || !isSupported || !text.trim()) {
    return null;
  }

  const label = `Phát âm ${text}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => speak(text, language)}
      aria-label={label}
      title={label}
      className={cn(compact ? "h-8 w-8 p-0" : "gap-1.5", className)}
    >
      <SpeakerIcon />
      {compact ? null : "Phát âm"}
    </Button>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
