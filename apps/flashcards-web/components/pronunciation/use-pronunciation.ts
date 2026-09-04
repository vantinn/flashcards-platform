"use client";

import { useCallback, useEffect, useState } from "react";
import { SPEECH_PITCH, SPEECH_RATE, SPEECH_VOLUME } from "./constants";

function isSpeechSynthesisSupported(): boolean {
  // Truthiness, not just `"speechSynthesis" in window` — some environments
  // (and a broken/blocked implementation) can define the property as
  // undefined/null rather than omitting it entirely.
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

/**
 * Prefers an exact BCP-47 match, falls back to the same language family
 * (e.g. any "zh-*" voice for a "zh-CN" request), then to the browser's
 * default voice for the utterance. Never assumes a specific vendor voice
 * exists — voice lists vary by browser/OS/device.
 */
export function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const exact = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;

  const family = lang.split("-")[0]?.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(family));
}

export interface UsePronunciationResult {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string, lang: string) => void;
  cancel: () => void;
}

export function usePronunciation(): UsePronunciationResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    // window.speechSynthesis doesn't exist during SSR, so support can only
    // be determined client-side after mount — same justification as
    // StudyPlayer's fetchSession mount effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(true);

    const synth = window.speechSynthesis;
    // speak() re-queries getVoices() live on every call, so nothing needs to
    // be stored here — this just primes the browser's voice list early
    // (Chromium/Safari populate it asynchronously) and cleans the listener
    // up on unmount.
    const primeVoices = () => synth.getVoices();
    primeVoices();
    synth.addEventListener("voiceschanged", primeVoices);
    return () => synth.removeEventListener("voiceschanged", primeVoices);
  }, []);

  const cancel = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, lang: string) => {
      if (!isSpeechSynthesisSupported() || !text.trim()) return;
      const synth = window.speechSynthesis;
      // Cancel-then-speak (never enqueue) is what keeps repeated clicks from
      // building up a speech queue — this always replaces, never appends.
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = SPEECH_RATE;
      utterance.pitch = SPEECH_PITCH;
      utterance.volume = SPEECH_VOLUME;
      const voice = pickBestVoice(synth.getVoices(), lang);
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synth.speak(utterance);
    },
    [],
  );

  // Stop any in-flight speech when this hook's owner unmounts (leaving the
  // study screen, navigating away, etc.) so audio never outlives its card.
  useEffect(() => () => cancel(), [cancel]);

  return { isSupported, isSpeaking, speak, cancel };
}
