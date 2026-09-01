"use client";

import { Dialog } from "./dialog";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onClose={onCancel} title={title} className="max-w-sm">
      <div className="flex flex-col gap-4">
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? t("common.pleaseWait") : (confirmLabel ?? t("common.confirm"))}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
