"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api-client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import type { PublicUser } from "@/types/flashcard";

export default function RegisterPage() {
  return (
    <Suspense fallback={<Card className="h-[30rem] w-full max-w-sm animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post<PublicUser>("/auth/register", { displayName, email, password });
      // Hard navigation — see the comment in the login page for why this
      // isn't router.push (stale Router Cache entries from pre-auth
      // prefetches of auth-gated routes).
      window.location.href = safeRedirectPath(searchParams.get("from"), "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const loginHref = searchParams.get("from")
    ? `/login?from=${encodeURIComponent(searchParams.get("from")!)}`
    : "/login";

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-dark">Create your account</h1>
          <p className="text-sm text-text-muted">Start building flashcard sets in minutes.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-name" className="text-sm font-medium text-text-dark">
              Full name
            </label>
            <Input
              id="register-name"
              type="text"
              required
              minLength={2}
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-email" className="text-sm font-medium text-text-dark">
              Email
            </label>
            <Input
              id="register-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-password" className="text-sm font-medium text-text-dark">
              Password
            </label>
            <Input
              id="register-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-xs text-text-muted">At least 8 characters.</p>
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
