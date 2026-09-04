"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserIcon } from "@/components/ui/icons";
import { SuccessIcon } from "@/components/ui/success-icon";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Gender, PublicUser } from "@/types/flashcard";

const GENDERS: Gender[] = ["male", "female"];
const AVATARS = ["1.png", "2.png"] as const;
type OnboardingAvatar = (typeof AVATARS)[number];

type Step = "gender" | "avatar" | "done";

export function OnboardingFlow() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("gender");
  const [gender, setGender] = useState<Gender | null>(null);
  const [avatar, setAvatar] = useState<OnboardingAvatar | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(selectedAvatar: OnboardingAvatar | null) {
    if (!gender || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch<PublicUser>("/users/me/onboarding", {
        gender,
        avatar: selectedAvatar ?? undefined,
      });
      setStep("done");
      // Hard navigation, not router.push — the (app) layout's onboarding
      // gate reads the user fresh from the server on every request; a soft
      // navigation could reuse a stale client-cached render from before
      // onboarding completed. Same reasoning as login/logout/register.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional, see comment above
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.somethingWrong"));
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-5">
        {step === "gender" && (
          <GenderStep
            gender={gender}
            onSelect={setGender}
            onContinue={() => setStep("avatar")}
          />
        )}
        {step === "avatar" && (
          <AvatarStep
            avatar={avatar}
            onSelect={setAvatar}
            submitting={submitting}
            onSkip={() => finish(null)}
            onFinish={() => finish(avatar)}
          />
        )}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <SuccessIcon />
            <p className="text-sm text-text-muted">{t("auth.register.redirecting")}</p>
          </div>
        )}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function GenderStep({
  gender,
  onSelect,
  onContinue,
}: {
  gender: Gender | null;
  onSelect: (gender: Gender) => void;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  const name = useId();

  return (
    <>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-text-dark">{t("onboarding.genderTitle")}</h1>
        <p className="mt-1 text-sm text-text-muted">{t("onboarding.genderSubtitle")}</p>
      </div>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">{t("onboarding.genderGroupLabel")}</legend>
        {GENDERS.map((value) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={value}
              checked={gender === value}
              onChange={() => onSelect(value)}
              className="peer sr-only"
            />
            <div className="flex flex-col items-center gap-2 rounded-card-lg border-2 border-border bg-white px-4 py-6 text-center transition-colors peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
              <UserIcon className="h-7 w-7 text-primary" />
              <span className="font-medium text-text-dark">{t(`onboarding.${value}`)}</span>
            </div>
          </label>
        ))}
      </fieldset>

      <Button type="button" disabled={!gender} onClick={onContinue}>
        {t("onboarding.continue")}
      </Button>
    </>
  );
}

function AvatarStep({
  avatar,
  onSelect,
  submitting,
  onSkip,
  onFinish,
}: {
  avatar: OnboardingAvatar | null;
  onSelect: (avatar: OnboardingAvatar) => void;
  submitting: boolean;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const { t } = useI18n();
  const name = useId();

  return (
    <>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-text-dark">{t("onboarding.avatarTitle")}</h1>
        <p className="mt-1 text-sm text-text-muted">{t("onboarding.avatarSubtitle")}</p>
      </div>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">{t("onboarding.avatarGroupLabel")}</legend>
        {AVATARS.map((value, index) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={value}
              checked={avatar === value}
              onChange={() => onSelect(value)}
              disabled={submitting}
              className="peer sr-only"
            />
            <div className="relative aspect-square w-full overflow-hidden rounded-card-lg border-2 border-border transition-colors peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
              <Image
                src={`/avatars/${value}`}
                alt={t("onboarding.avatarOptionLabel", { index: index + 1 })}
                fill
                sizes="(max-width: 640px) 40vw, 160px"
                className="object-cover"
              />
            </div>
          </label>
        ))}
      </fieldset>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" disabled={submitting} onClick={onSkip}>
          {t("onboarding.skip")}
        </Button>
        <Button type="button" className="flex-1" disabled={submitting} onClick={onFinish}>
          {submitting ? t("onboarding.saving") : t("onboarding.finish")}
        </Button>
      </div>
    </>
  );
}
