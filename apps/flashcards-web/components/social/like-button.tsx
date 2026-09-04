"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HeartIcon } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface LikeButtonProps {
  setId: string;
  initialLiked: boolean;
  initialLikeCount: number;
}

interface LikeState {
  liked: boolean;
  likeCount: number;
}

export function LikeButton({ setId, initialLiked, initialLikeCount }: LikeButtonProps) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref (not just the `pending` state) guards re-entrancy: rapid clicks
  // fired in the same tick can all read a stale `pending=false` before
  // React commits the first click's state update, but a ref update is
  // immediate and synchronous, so it reliably blocks every click after the
  // first regardless of render timing.
  const inFlight = useRef(false);

  async function toggle() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);

    // Optimistic flip, reconciled with the server's response below — rolled
    // back entirely on failure rather than left half-applied.
    const previous = { liked, likeCount };
    const optimisticallyLiked = !liked;
    setLiked(optimisticallyLiked);
    setLikeCount((count) => count + (optimisticallyLiked ? 1 : -1));

    try {
      const result = optimisticallyLiked
        ? await api.post<LikeState>(`/flashcard-sets/${setId}/likes`)
        : await api.delete<LikeState>(`/flashcard-sets/${setId}/likes`);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (err) {
      setLiked(previous.liked);
      setLikeCount(previous.likeCount);
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.networkError"));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={liked ? "primary" : "outline"}
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? t("social.unlikeAriaLabel") : t("social.likeAriaLabel")}
        className="gap-2"
      >
        <HeartIcon className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
        {likeCount}
      </Button>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
