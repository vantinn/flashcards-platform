import type { SetLanguage } from "@/types/flashcard";

export const SET_LANGUAGE_LABELS: Record<SetLanguage, string> = {
  english: "Tiếng Anh",
  chinese: "Tiếng Trung",
  free: "Tự do",
};

/** BCP-47 tag for Web Speech API, or null when the set has no pronunciation language. */
export const SET_LANGUAGE_TO_SPEECH_LANG: Record<SetLanguage, string | null> = {
  english: "en-US",
  chinese: "zh-CN",
  free: null,
};

export function speechLangFor(language: SetLanguage | null | undefined): string | null {
  if (!language) return null;
  return SET_LANGUAGE_TO_SPEECH_LANG[language];
}
