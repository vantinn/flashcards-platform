/**
 * Shared text normalization used both to compare a typed-answer submission
 * against a card's front text, and to de-duplicate answer values when
 * building multiple-choice distractors (see build-choices.ts). Exact-match
 * only — trim, collapse internal whitespace, case-fold — no fuzzy
 * matching, per product spec.
 */
export function normalizeAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
