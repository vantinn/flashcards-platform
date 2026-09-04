import type { TranslationKey } from "./dictionary";

/**
 * The backend's HttpExceptionFilter guarantees every thrown error's message
 * is already safe and specific (never a stack trace/internal detail) — but
 * it's always English free-text, with no error-code field to key off. This
 * maps the finite, known set of backend messages this app's UI actually
 * surfaces to translation keys, so localization stays entirely
 * frontend-side (no backend changes needed, per the task's own preference
 * for mapping known messages over touching backend domain logic). Anything
 * unrecognized — including OTP/rate-limit cooldowns with a dynamic second
 * count baked into the sentence — falls through to a generic, still-
 * localized fallback rather than showing raw English.
 */
const KNOWN_BACKEND_MESSAGES: [substring: string, key: TranslationKey][] = [
  ["Invalid email or password", "errors.invalidCredentials"],
  ["Please verify your email before logging in", "errors.emailNotVerified"],
  ["An account with this email already exists", "errors.emailAlreadyRegistered"],
  ["Invalid or expired verification code", "errors.invalidOtp"],
  ["Too many incorrect attempts", "errors.otpExpired"],
  ["Invalid or expired password reset request", "errors.otpExpired"],
  ["Too many verification codes requested", "errors.rateLimited"],
  ["Too many requests", "errors.rateLimited"],
  ["Invalid or expired refresh token", "errors.invalidRefreshToken"],
  ["Passwords do not match", "auth.forgotPassword.passwordMismatch"],
];

/** Matches "Please wait 45s before requesting another code." style messages, keeping the dynamic count. */
const COOLDOWN_PATTERN = /please wait (\d+)s before requesting another code/i;

export function mapBackendMessage(
  message: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string | null {
  const cooldownMatch = message.match(COOLDOWN_PATTERN);
  if (cooldownMatch) {
    return t("errors.rateLimited");
  }
  const found = KNOWN_BACKEND_MESSAGES.find(([substring]) => message.includes(substring));
  return found ? t(found[1]) : null;
}
