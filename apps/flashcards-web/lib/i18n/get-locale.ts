import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";

/**
 * Server-side locale resolution. Next.js request-memoizes `cookies()`, so
 * calling this from many Server Components in one render tree costs nothing
 * extra — no prop-drilling needed. Missing or invalid cookie → Vietnamese,
 * per the product requirement that Vietnamese is the true default, not just
 * a fallback for missing translations.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
