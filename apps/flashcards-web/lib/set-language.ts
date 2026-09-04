import type { SetLanguage } from "@/types/flashcard";
import type { Translator, TranslationKey } from "./i18n/dictionary";

export const SET_LANGUAGES: SetLanguage[] = ["english", "chinese", "free"];

const LABEL_KEYS: Record<SetLanguage, TranslationKey> = {
  english: "category.english",
  chinese: "category.chinese",
  free: "category.free",
};

/** The official Set Category ("Danh mục") display label for this locale. */
export function setLanguageLabel(language: SetLanguage, t: Translator): string {
  return t(LABEL_KEYS[language]);
}

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
