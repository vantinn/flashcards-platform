import type { SetVisibility } from "@/types/flashcard";
import type { Translator, TranslationKey } from "./i18n/dictionary";

export const SET_VISIBILITIES: SetVisibility[] = ["private", "unlisted", "public"];

const LABEL_KEYS: Record<SetVisibility, TranslationKey> = {
  private: "visibility.private",
  unlisted: "visibility.unlisted",
  public: "visibility.public",
};

const HINT_KEYS: Record<SetVisibility, TranslationKey> = {
  private: "visibility.privateHint",
  unlisted: "visibility.unlistedHint",
  public: "visibility.publicHint",
};

/** Short display label, e.g. for badges: "Riêng tư" / "Private". */
export function setVisibilityLabel(visibility: SetVisibility, t: Translator): string {
  return t(LABEL_KEYS[visibility]);
}

/** Longer descriptive label for form <option>s, e.g. "Riêng tư — chỉ mình bạn". */
export function setVisibilityHint(visibility: SetVisibility, t: Translator): string {
  return t(HINT_KEYS[visibility]);
}
