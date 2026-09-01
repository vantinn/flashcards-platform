import type { Locale } from "./locale";
import { DEFAULT_LOCALE } from "./locale";
import vi from "./dictionaries/vi";
import en from "./dictionaries/en";

export type Dictionary = typeof vi;

const dictionaries: Record<Locale, Dictionary> = { vi, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

type Vars = Record<string, string | number>;

/** All dot-paths reachable in the dictionary, e.g. "auth.login.submit". */
type DotPaths<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string
        ? `${Prefix}${K}`
        : DotPaths<T[K], `${Prefix}${K}.`>;
    }[keyof T & string]
  : never;

export type TranslationKey = DotPaths<Dictionary>;

function lookup(dict: Dictionary, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Dot-path translator, e.g. t("auth.login.submit"). Falls back to the
 * Vietnamese string, then to the raw key itself, so a missing translation
 * never renders "undefined" and ultimately resolves to Vietnamese — matching
 * the product's fallback requirement.
 */
export function createTranslator(dict: Dictionary) {
  return function t(key: TranslationKey, vars?: Vars): string {
    const value = lookup(dict, key) ?? lookup(vi, key) ?? key;
    return interpolate(value, vars);
  };
}

export type Translator = ReturnType<typeof createTranslator>;

export { DEFAULT_LOCALE };
