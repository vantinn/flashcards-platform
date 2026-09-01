/** Minimum number of other answers before a wrong card resurfaces. */
export const RETRY_GAP = 3;

/**
 * Minimum number of other answers before a Deep Learning card that just
 * passed multiple-choice becomes eligible for its typed-answer stage —
 * without this, the same card would be served twice back-to-back.
 */
export const STAGE_ADVANCE_GAP = 2;

export interface PendingCardState {
  flashcardId: string;
  /** Flashcard.position — reused as a deterministic tie-break, not a new column. */
  flashcardPosition: number;
  dueSequence: number;
  attempts: number;
}

/**
 * Deterministically picks the next not-yet-completed card to serve.
 * Deliberately no randomness here — only answer *choice* generation and
 * choice *position* are randomized elsewhere; which card comes next is
 * fully determined by (dueSequence, attempts, position), so replaying the
 * same session state always yields the same next card.
 *
 * Prefers cards whose cool-down has elapsed (`dueSequence <= sequence`).
 * If every remaining card is still mid-cool-down, falls back to the whole
 * pending set instead of stalling — the session must always make forward
 * progress. A 1-card set re-serving the same card immediately after a
 * wrong answer is the correct, unavoidable result of this fallback (there
 * is no other card to interleave), not a bug.
 */
export function pickNextCard(pending: PendingCardState[], sequence: number): PendingCardState | null {
  if (pending.length === 0) return null;

  const eligible = pending.filter((state) => state.dueSequence <= sequence);
  const pool = eligible.length > 0 ? eligible : pending;

  return [...pool].sort(
    (a, b) =>
      a.dueSequence - b.dueSequence || a.attempts - b.attempts || a.flashcardPosition - b.flashcardPosition,
  )[0];
}

/** Called on any wrong answer (Cram, or either Deep Learning stage). */
export function dueSequenceAfterWrongAnswer(sequence: number): number {
  return sequence + RETRY_GAP;
}

/** Called only when Deep Learning's multiple-choice stage just passed. */
export function dueSequenceAfterMultipleChoicePass(sequence: number): number {
  return sequence + STAGE_ADVANCE_GAP;
}
