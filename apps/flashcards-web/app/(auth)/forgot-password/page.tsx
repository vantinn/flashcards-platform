"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { OtpInput } from "@/components/ui/otp-input";
import { SuccessIcon } from "@/components/ui/success-icon";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";

// The backend deliberately never tells us whether a resend is actually
// possible (that would leak account existence — see AuthService.forgotPassword),
// so this is just a reasonable default matching the server's own
// OTP_RESEND_COOLDOWN_SECONDS default rather than a value the API returns.
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");

  if (step === "email") {
    return (
      <EmailStep
        onSubmitted={(submittedEmail) => {
          setEmail(submittedEmail);
          setStep("otp");
        }}
      />
    );
  }

  if (step === "otp") {
    return (
      <OtpStep
        email={email}
        onVerified={(token) => {
          setResetToken(token);
          setStep("reset");
        }}
        onBack={() => setStep("email")}
      />
    );
  }

  if (step === "reset") {
    return <ResetStep resetToken={resetToken} onDone={() => setStep("done")} />;
  }

  return <DoneStep />;
}

function EmailStep({ onSubmitted }: { onSubmitted: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      onSubmitted(email);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-dark">Reset your password</h1>
          <p className="text-sm text-text-muted">Enter your email and we&apos;ll send you a verification code.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-email" className="text-sm font-medium text-text-dark">
              Email
            </label>
            <Input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              disabled={submitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send code"}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted">
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

function OtpStep({
  email,
  onVerified,
  onBack,
}: {
  email: string;
  onVerified: (resetToken: string) => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [otpBoxKey, setOtpBoxKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(DEFAULT_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || otp.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<{ resetToken: string; expiresInMinutes: number }>("/auth/verify-reset-otp", {
        email,
        otp,
      });
      onVerified(result.resetToken);
    } catch (err) {
      setError(getErrorMessage(err));
      setOtp("");
      setOtpBoxKey((key) => key + 1); // remounts OtpInput, clearing the boxes for a retry
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    setError(null);
    setResendMessage(null);
    try {
      await api.post("/auth/resend-otp", { email, purpose: "PASSWORD_RESET" });
      setResendMessage("If an account with this email exists, a new code has been sent.");
      setCooldown(DEFAULT_RESEND_COOLDOWN_SECONDS);
      setOtp("");
      setOtpBoxKey((key) => key + 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-dark">Enter your code</h1>
          <p className="text-sm text-text-muted">
            If an account exists for <span className="font-medium text-text-dark">{email}</span>, we sent it a
            6-digit code.
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
            {submitting ? "Verifying..." : "Verify code"}
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

function ResetStep({ resetToken, onDone }: { resetToken: string; onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { resetToken, newPassword, confirmPassword });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-dark">Choose a new password</h1>
          <p className="text-sm text-text-muted">Your code has been verified.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-sm font-medium text-text-dark">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={submitting}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="text-xs text-text-muted">At least 8 characters.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-password" className="text-sm font-medium text-text-dark">
              Confirm password
            </label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={submitting}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Reset password"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function DoneStep() {
  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
        <SuccessIcon />
        <h1 className="text-xl font-semibold text-text-dark">Password reset</h1>
        <p className="text-sm text-text-muted">
          Your password has been changed. Any other signed-in devices have been signed out.
        </p>
        <Link href="/login" className="w-full">
          <Button className="w-full">Log in</Button>
        </Link>
      </CardBody>
    </Card>
  );
}
