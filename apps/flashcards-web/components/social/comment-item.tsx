"use client";

import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { timeAgo } from "@/lib/time-ago";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { SetComment } from "@/types/flashcard";

const MAX_CONTENT_LENGTH = 2000;

export interface CommentItemProps {
  setId: string;
  comment: SetComment;
  onUpdated: (comment: SetComment) => void;
  onDeleted: (commentId: string) => void;
  /** Replies never show their own Reply action or nested replies — V1 supports exactly one level. */
  isReply?: boolean;
}

export function CommentItem({ setId, comment, onUpdated, onDeleted, isReply = false }: CommentItemProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replies, setReplies] = useState<SetComment[] | null>(null);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replyCount, setReplyCount] = useState(comment.replyCount);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReplies() {
    setError(null);
    try {
      const result = await api.get<SetComment[]>(`/flashcard-sets/${setId}/comments/${comment.id}/replies`);
      setReplies(result);
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.networkError"));
    }
  }

  async function toggleReplies() {
    const next = !repliesOpen;
    setRepliesOpen(next);
    if (next && replies === null) {
      await loadReplies();
    }
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !editContent.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.patch<SetComment>(`/comments/${comment.id}`, { content: editContent });
      setEditing(false);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (submitting || !replyContent.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<SetComment>(`/flashcard-sets/${setId}/comments/${comment.id}/replies`, {
        content: replyContent,
      });
      setReplies((current) => [...(current ?? []), created]);
      setReplyCount((count) => count + 1);
      setRepliesOpen(true);
      setReplyContent("");
      setReplying(false);
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await api.delete(`/comments/${comment.id}`);
      onDeleted(comment.id);
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.networkError"));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex gap-3">
      <Avatar name={comment.author.displayName} avatarUrl={comment.author.avatarUrl} size="sm" />
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-dark">{comment.author.displayName}</span>
          <span className="text-xs text-text-muted">{timeAgo(comment.createdAt, t)}</span>
          {comment.updatedAt !== comment.createdAt ? (
            <span className="text-xs text-text-muted">{t("social.editedLabel")}</span>
          ) : null}
        </div>

        {editing ? (
          <form onSubmit={submitEdit} className="mt-1 flex flex-col gap-2">
            <Textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              maxLength={MAX_CONTENT_LENGTH}
              rows={2}
              disabled={submitting}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting || !editContent.trim()}>
                {t("social.save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => {
                  setEditing(false);
                  setEditContent(comment.content);
                }}
              >
                {t("social.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-dark">{comment.content}</p>
        )}

        {error ? (
          <p className="mt-1 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-medium text-text-muted">
          {!isReply ? (
            <button type="button" onClick={() => setReplying((value) => !value)} className="hover:text-primary">
              {t("social.reply")}
            </button>
          ) : null}
          {comment.canEdit && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="hover:text-primary">
              {t("social.edit")}
            </button>
          ) : null}
          {comment.canDelete ? (
            <button type="button" onClick={() => setDeleteOpen(true)} className="hover:text-danger">
              {t("social.delete")}
            </button>
          ) : null}
        </div>

        {replying ? (
          <form onSubmit={submitReply} className="mt-2 flex flex-col gap-2">
            <Textarea
              value={replyContent}
              onChange={(event) => setReplyContent(event.target.value)}
              placeholder={t("social.replyPlaceholder")}
              maxLength={MAX_CONTENT_LENGTH}
              rows={2}
              disabled={submitting}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting || !replyContent.trim()}>
                {submitting ? t("social.posting") : t("social.postReply")}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => setReplying(false)}>
                {t("social.cancel")}
              </Button>
            </div>
          </form>
        ) : null}

        {!isReply && replyCount > 0 ? (
          <button type="button" onClick={toggleReplies} className="mt-2 block text-xs font-medium text-primary hover:underline">
            {repliesOpen
              ? t("social.hideReplies")
              : replyCount === 1
                ? t("social.viewReplies_one", { count: replyCount })
                : t("social.viewReplies_other", { count: replyCount })}
          </button>
        ) : null}

        {repliesOpen && replies ? (
          <div className="mt-3 flex flex-col gap-3 border-l-2 border-border pl-4">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                setId={setId}
                comment={reply}
                isReply
                onUpdated={(updated) =>
                  setReplies((current) => current?.map((r) => (r.id === updated.id ? updated : r)) ?? null)
                }
                onDeleted={(id) => {
                  setReplies((current) => current?.filter((r) => r.id !== id) ?? null);
                  setReplyCount((count) => Math.max(0, count - 1));
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={t("social.deleteConfirmTitle")}
        description={t("social.deleteConfirmDesc")}
        confirmLabel={t("social.delete")}
        danger
        busy={submitting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
