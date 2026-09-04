"use client";

import { useState, type FormEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { CommentItem } from "./comment-item";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { SetComment } from "@/types/flashcard";
import type { PaginatedResult } from "@/types/pagination";

const MAX_CONTENT_LENGTH = 2000;

export interface CommentSectionProps {
  setId: string;
  initialComments: PaginatedResult<SetComment>;
}

export function CommentSection({ setId, initialComments }: CommentSectionProps) {
  const { t } = useI18n();
  const [items, setItems] = useState(initialComments.items);
  const [total, setTotal] = useState(initialComments.total);
  const [page, setPage] = useState(initialComments.page);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const hasMore = items.length < total;

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const nextPage = page + 1;
      const result = await api.get<PaginatedResult<SetComment>>(
        `/flashcard-sets/${setId}/comments?page=${nextPage}&limit=${initialComments.limit}`,
      );
      setItems((current) => [...current, ...result.items]);
      setPage(result.page);
      setTotal(result.total);
    } catch (err) {
      setLoadError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.networkError"));
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (posting || !content.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const created = await api.post<SetComment>(`/flashcard-sets/${setId}/comments`, { content });
      setItems((current) => [created, ...current]);
      setTotal((count) => count + 1);
      setContent("");
    } catch (err) {
      setPostError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.networkError"));
    } finally {
      setPosting(false);
    }
  }

  function handleUpdated(updated: SetComment) {
    setItems((current) => current.map((comment) => (comment.id === updated.id ? updated : comment)));
  }

  function handleDeleted(commentId: string) {
    setItems((current) => current.filter((comment) => comment.id !== commentId));
    setTotal((count) => Math.max(0, count - 1));
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-text-dark">{t("social.commentsTitle")}</h2>

      <form onSubmit={submitComment} className="flex flex-col gap-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("social.commentPlaceholder")}
          maxLength={MAX_CONTENT_LENGTH}
          rows={3}
          disabled={posting}
        />
        {postError ? (
          <p className="text-sm text-danger" role="alert">
            {postError}
          </p>
        ) : null}
        <Button type="submit" disabled={posting || !content.trim()} className="self-start">
          {posting ? t("social.posting") : t("social.postComment")}
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title={t("social.noCommentsTitle")} description={t("social.noCommentsDesc")} />
      ) : (
        <div className="flex flex-col gap-5">
          {items.map((comment) => (
            <CommentItem key={comment.id} setId={setId} comment={comment} onUpdated={handleUpdated} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {loadError ? <ErrorState title={t("social.couldNotLoad")} /> : null}

      {hasMore ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? t("common.loading") : t("social.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
