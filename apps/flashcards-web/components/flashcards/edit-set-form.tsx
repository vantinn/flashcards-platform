"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { SET_LANGUAGES, setLanguageLabel } from "@/lib/set-language";
import { SET_VISIBILITIES, setVisibilityHint } from "@/lib/set-visibility";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { FlashcardSet, FlashcardSetDetail, SetLanguage, SetVisibility } from "@/types/flashcard";

export interface EditSetFormProps {
  set: FlashcardSetDetail;
}

// Mirrors CreateSetPage's form fields exactly (title/description/Danh mục/
// visibility) — this was the one CRUD gap the cross-platform audit found:
// Android and iOS both had a dedicated "edit set details" screen, but the
// web app's "Edit" button on a set only ever opened the card editor, with
// no way to change a set's title, description, category, or visibility
// after creation.
export function EditSetForm({ set }: EditSetFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState(set.title);
  const [description, setDescription] = useState(set.description ?? "");
  const [language, setLanguage] = useState<SetLanguage>(set.language);
  const [visibility, setVisibility] = useState<SetVisibility>(set.visibility);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch<FlashcardSet>(`/flashcard-sets/${set.id}`, {
        title,
        description: description || undefined,
        language,
        visibility,
      });
      router.push(`/sets/${set.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err, t) : t("common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-dark" htmlFor="title">
              {t("sets.titleLabel")}
            </label>
            <Input
              id="title"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-dark" htmlFor="description">
              {t("sets.descriptionLabel")}
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-dark" htmlFor="language">
              {t("category.label")}
            </label>
            <Select id="language" value={language} onChange={(event) => setLanguage(event.target.value as SetLanguage)}>
              {SET_LANGUAGES.map((value) => (
                <option key={value} value={value}>
                  {setLanguageLabel(value, t)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-dark" htmlFor="visibility">
              {t("sets.visibilityLabel")}
            </label>
            <Select
              id="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as SetVisibility)}
            >
              {SET_VISIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {setVisibilityHint(value, t)}
                </option>
              ))}
            </Select>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" disabled={submitting || !title}>
            {submitting ? t("sets.saving") : t("sets.saveChanges")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
