"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { PublicUser } from "@/types/flashcard";

export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="h-[26rem] w-full max-w-sm animate-pulse" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post<PublicUser>("/auth/login", { email, password });
      // A hard navigation, not router.push — Next's client Router Cache can
      // have a stale entry for the target route (e.g. a redirect-to-login
      // it cached from an earlier, unauthenticated prefetch), and a soft
      // navigation would happily reuse that stale entry right after we've
      // just changed the auth state that produced it.
      window.location.href = safeRedirectPath(searchParams.get("from"), "/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, t));
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-dark">{t("auth.login.welcomeBack")}</h1>
          <p className="text-sm text-text-muted">{t("auth.login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm font-medium text-text-dark">
              {t("auth.login.email")}
            </label>
            <Input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              disabled={submitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-medium text-text-dark">
                {t("auth.login.password")}
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                {t("auth.login.forgotPassword")}
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              disabled={submitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted">
          {t("auth.login.noAccount")}
          <Link
            href={searchParams.get("from") ? `/register?from=${encodeURIComponent(searchParams.get("from")!)}` : "/register"}
            className="font-medium text-primary hover:underline"
          >
            {t("auth.login.signUp")}
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
