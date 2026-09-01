"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { OtpInput } from "@/components/ui/otp-input";
import { SuccessIcon } from "@/components/ui/success-icon";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { safeRedirectPath } from "@/lib/safe-redirect";
import type { PublicUser } from "@/types/flashcard";

interface PendingRegistration {
  email: string;
  expiresInMinutes: number;
  resendAvailableInSeconds: number;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Card className="h-[30rem] w-full max-w-sm animate-pulse" />}>
      <RegisterFlow />
    </Suspense>
  );
}

function RegisterFlow() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<PendingRegistration | null>(null);

  const loginHref = searchParams.get("from")
    ? `/login?from=${encodeURIComponent(searchParams.get("from")!)}`
    : "/login";

  if (pending) {
    return <VerifyOtpForm pending={pending} onBack={() => setPending(null)} />;
  }

  return <RegisterForm loginHref={loginHref} onRegistered={setPending} />;
}

function RegisterForm({
  loginHref,
  onRegistered,
}: {
  loginHref: string;
  onRegistered: (pending: PendingRegistration) => void;
}) {
  const [displayName, setDisplayName] = useState("");
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
      const result = await api.post<PendingRegistration>("/auth/register", { displayName, email, password });
      onRegistered(result);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

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
              disabled={submitting}
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
              disabled={submitting}
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
              disabled={submitting}
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

function VerifyOtpForm({ pending, onBack }: { pending: PendingRegistration; onBack: () => void }) {
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState("");
  const [otpBoxKey, setOtpBoxKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(pending.resendAvailableInSeconds);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // A brief, motion-free acknowledgment before the hard navigation below —
  // without it, success is invisible (the redirect happens immediately).
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => {
      window.location.href = safeRedirectPath(searchParams.get("from"), "/dashboard");
    }, 600);
    return () => clearTimeout(timer);
  }, [verified, searchParams]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || otp.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post<PublicUser>("/auth/verify-registration", { email: pending.email, otp });
      setVerified(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
      setOtp("");
      setOtpBoxKey((key) => key + 1); // remounts OtpInput, clearing the boxes for a retry
    }
  }

  async function handleResend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    setError(null);
    setResendMessage(null);
    try {
      await api.post("/auth/resend-otp", { email: pending.email, purpose: "REGISTRATION" });
      setResendMessage("A new code has been sent.");
      setCooldown(pending.resendAvailableInSeconds);
      setOtp("");
      setOtpBoxKey((key) => key + 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
          <SuccessIcon />
          <h1 className="text-xl font-semibold text-text-dark">Email verified</h1>
          <p className="text-sm text-text-muted">Redirecting you now...</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-dark">Check your email</h1>
          <p className="text-sm text-text-muted">
            We sent a 6-digit code to <span className="font-medium text-text-dark">{pending.email}</span>. It expires
            in {pending.expiresInMinutes} minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-dark">Verification code</span>
            <OtpInput
              key={otpBoxKey}
              label="Verification code, 6 digits"
              disabled={submitting}
              onChange={setOtp}
            />
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {resendMessage ? (
            <p className="text-sm text-text-muted" aria-live="polite">
              {resendMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting || otp.length !== 6}>
            {submitting ? "Verifying..." : "Verify email"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onBack} className="font-medium text-text-muted hover:underline">
            Use a different email
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="font-medium text-primary hover:underline disabled:pointer-events-none disabled:text-text-muted"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? "Sending..." : "Resend code"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
