"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface SetActionsProps {
  setId: string;
  setTitle: string;
  canStudy: boolean;
}

export function SetActions({ setId, setTitle, canStudy }: SetActionsProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/flashcard-sets/${setId}`);
      router.push("/sets");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("sets.couldNotDelete"));
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    setError(null);
    try {
      const copy = await api.post<{ id: string }>(`/flashcard-sets/${setId}/duplicate`);
      router.push(`/sets/${copy.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("sets.couldNotDuplicate"));
      setDuplicating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/sets/${setId}/settings`}>
          <Button variant="outline">{t("sets.editDetails")}</Button>
        </Link>
        <Link href={`/sets/${setId}/edit`}>
          <Button variant="outline">{t("sets.editCards")}</Button>
        </Link>
        <Link href={`/sets/${setId}/study`}>
          <Button disabled={!canStudy}>{t("sets.startStudying")}</Button>
        </Link>
        <Button variant="outline" onClick={handleDuplicate} disabled={duplicating}>
          {duplicating ? t("sets.duplicating") : t("sets.duplicate")}
        </Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          {t("sets.delete")}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <ConfirmDialog
        open={confirmOpen}
        title={t("sets.deleteConfirmTitle")}
        description={t("sets.deleteConfirmDescription", { title: setTitle })}
        confirmLabel={t("sets.deleteConfirmLabel")}
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
