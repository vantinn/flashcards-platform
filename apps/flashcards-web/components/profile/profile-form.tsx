"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import type { PublicUser } from "@/types/flashcard";

export interface ProfileFormProps {
  user: PublicUser;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await api.patch<PublicUser>("/users/me", {
        displayName,
        avatarUrl: avatarUrl || undefined,
      });
      setSuccess(true);
      // The navbar's user menu reads the current user server-side (a
      // Server Component prop, not client state) — refresh so the new
      // name/avatar show up there immediately instead of after the next
      // full navigation.
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          onChange={() => setSuccess(false)}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-dark" htmlFor="email">
              Email
            </label>
            <Input id="email" value={user.email} disabled />
            <p className="text-xs text-text-muted">Your email can&apos;t be changed here.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-dark" htmlFor="displayName">
              Display name
            </label>
            <Input
              id="displayName"
              required
              minLength={2}
              maxLength={100}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-dark" htmlFor="avatarUrl">
              Avatar URL <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <Input
              id="avatarUrl"
              type="url"
              placeholder="https://example.com/avatar.png"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </div>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {success ? <p className="text-sm text-success">Profile updated.</p> : null}

          <Button type="submit" disabled={submitting || !displayName}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
