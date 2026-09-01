import { ApiError } from "./api-client";
import { mapBackendMessage } from "./i18n/backend-error-map";
import type { Translator } from "./i18n/dictionary";

/**
 * Maps a caught error to safe, localized, user-facing copy. ApiError already
 * carries the backend's own message, and HttpExceptionFilter (server-side)
 * is the actual safety boundary — it never lets a stack trace or internal
 * detail through the message field for *any* status code. That message is
 * always English free-text with no error code, though, so mapBackendMessage
 * translates the finite set of messages this app's UI actually surfaces.
 * Anything unrecognized (an unmapped validation message, a genuinely
 * unexpected 500, etc.) falls back to a generic, localized message rather
 * than ever showing raw untranslated backend English.
 */
export function getErrorMessage(error: unknown, t: Translator): string {
  if (error instanceof ApiError) {
    if (!error.message) return t("common.somethingWrong");
    return mapBackendMessage(error.message, t) ?? t("common.somethingWrong");
  }
  return t("common.networkError");
}
