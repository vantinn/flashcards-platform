"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { parseBulkFlashcards, type ParsedRowStatus } from "@/lib/parse-bulk-flashcards";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Flashcard } from "@/types/flashcard";

// Matches the backend's default MAX_BULK_FLASHCARDS (see
// flashcards.config.ts) — purely a proactive client-side warning/preview
// cap. The backend independently enforces its own (possibly
// admin-reconfigured) limit regardless, and remains the real authority; a
// drift between the two only ever produces a slightly-late error message
// here, never a data-integrity or security gap.
const MAX_BULK_IMPORT = 500;
// Caps how many preview rows are actually rendered, independent of
// MAX_BULK_IMPORT, so a user pasting far more than the import limit still
// gets a bounded, responsive table rather than thousands of DOM rows.
const MAX_PREVIEW_ROWS = 500;

const EXAMPLE_ROWS: [string, string][] = [
  ["hello", "xin chào"],
  ["world", "thế giới"],
  ["book", "quyển sách"],
];

interface BulkImportResponse {
  cards: Flashcard[];
  totalReceived: number;
  importedCount: number;
  duplicateCount: number;
}

export interface BulkAddDialogProps {
  open: boolean;
  onClose: () => void;
  setId: string;
  existingCards: Flashcard[];
  onImported: (cards: Flashcard[]) => void;
}

const STATUS_BADGE_VARIANT: Record<ParsedRowStatus, "success" | "danger" | "default"> = {
  valid: "success",
  invalid: "danger",
  duplicate: "default",
};

export function BulkAddDialog({ open, onClose, setId, existingCards, onImported }: BulkAddDialogProps) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ response: BulkImportResponse; totalParsed: number; invalidCount: number } | null>(
    null,
  );

  const existingPairs = useMemo(
    () => existingCards.map((card) => ({ front: card.front, back: card.back })),
    [existingCards],
  );
  const parsed = useMemo(() => parseBulkFlashcards(text, existingPairs), [text, existingPairs]);
  const validRows = useMemo(() => parsed.rows.filter((row) => row.status === "valid"), [parsed.rows]);
  const overLimit = validRows.length > MAX_BULK_IMPORT;

  function statusLabel(status: ParsedRowStatus): string {
    if (status === "valid") return t("cards.bulk.statusValid");
    if (status === "duplicate") return t("cards.bulk.statusDuplicate");
    return t("cards.bulk.statusInvalid");
  }

  function reset() {
    setText("");
    setError(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleImport() {
    if (validRows.length === 0 || overLimit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.post<BulkImportResponse>(`/flashcard-sets/${setId}/cards/bulk`, {
        cards: validRows.map((row) => ({ front: row.front, back: row.back })),
      });
      setResult({ response, totalParsed: parsed.rows.length, invalidCount: parsed.invalidCount });
      onImported(response.cards);
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("cards.bulk.couldNotImport"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={t("cards.bulk.title")} className="max-w-3xl">
      {result ? (
        <div className="flex flex-col gap-4">
          <p className="text-lg font-semibold text-text-dark">
            {t("cards.bulk.resultHeadline", { count: result.response.importedCount })}
          </p>
          <dl className="grid grid-cols-2 gap-3 rounded-card-lg border border-border p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-text-muted">{t("cards.bulk.summaryTotal")}</dt>
              <dd className="text-lg font-semibold text-text-dark">{result.totalParsed}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cards.bulk.summaryImported")}</dt>
              <dd className="text-lg font-semibold text-success">{result.response.importedCount}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cards.bulk.summaryDuplicate")}</dt>
              <dd className="text-lg font-semibold text-text-dark">{result.response.duplicateCount}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("cards.bulk.summaryInvalid")}</dt>
              <dd className="text-lg font-semibold text-text-dark">{result.invalidCount}</dd>
            </div>
          </dl>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              {t("cards.bulk.importMore")}
            </Button>
            <Button type="button" onClick={handleClose}>
              {t("cards.bulk.done")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-card-lg bg-black/5 p-4 text-sm text-text-dark">
            <p className="font-semibold">{t("cards.bulk.instructionsTitle")}</p>
            <p className="mt-1 text-text-muted">{t("cards.bulk.instructionsBody")}</p>
            <p className="mt-3 font-medium">{t("cards.bulk.instructionsFormatLabel")}</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-1 pr-4 font-medium">{t("cards.front")}</th>
                    <th className="py-1 font-medium">{t("cards.back")}</th>
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE_ROWS.map(([front, back]) => (
                    <tr key={front} className="border-b border-border/60 last:border-0">
                      <td className="py-1 pr-4 text-text-dark">{front}</td>
                      <td className="py-1 text-text-dark">{back}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-text-muted">{t("cards.bulk.instructionsFooter")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-paste-textarea" className="text-sm font-medium text-text-dark">
              {t("cards.bulk.pasteLabel")}
            </label>
            <Textarea
              id="bulk-paste-textarea"
              rows={6}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("cards.bulk.pastePlaceholder")}
              disabled={submitting}
            />
          </div>

          {parsed.rows.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                <span>{t("cards.bulk.previewSummary", { total: parsed.rows.length })}</span>
                <Badge variant="success">{t("cards.bulk.previewValidCount", { count: parsed.validCount })}</Badge>
                {parsed.duplicateCount > 0 ? (
                  <Badge>{t("cards.bulk.previewDuplicateCount", { count: parsed.duplicateCount })}</Badge>
                ) : null}
                {parsed.invalidCount > 0 ? (
                  <Badge variant="danger">{t("cards.bulk.previewInvalidCount", { count: parsed.invalidCount })}</Badge>
                ) : null}
              </div>

              {overLimit ? (
                <p className="text-sm text-danger" role="alert">
                  {t("cards.bulk.overLimit", { max: MAX_BULK_IMPORT })}
                </p>
              ) : null}

              <div className="max-h-72 overflow-auto rounded-card-lg border border-border">
                <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2">{t("cards.bulk.columnIndex")}</th>
                      <th className="px-3 py-2">{t("cards.front")}</th>
                      <th className="px-3 py-2">{t("cards.back")}</th>
                      <th className="px-3 py-2">{t("cards.bulk.columnStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => (
                      <tr key={row.index} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 text-text-muted">{row.index}</td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-text-dark">{row.front}</td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-text-dark">{row.back}</td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{statusLabel(row.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > MAX_PREVIEW_ROWS ? (
                <p className="text-xs text-text-muted">
                  {t("cards.bulk.previewTruncated", { shown: MAX_PREVIEW_ROWS, total: parsed.rows.length })}
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleImport} disabled={validRows.length === 0 || overLimit || submitting}>
              {submitting ? t("cards.bulk.importing") : t("cards.bulk.importValid", { count: validRows.length })}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
