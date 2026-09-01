"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { SET_LANGUAGE_LABELS } from "@/lib/set-language";
import type { FlashcardSet, SetLanguage, SetVisibility } from "@/types/flashcard";

export default function CreateSetPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<SetLanguage>("free");
  const [visibility, setVisibility] = useState<SetVisibility>("private");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const set = await api.post<FlashcardSet>("/flashcard-sets", {
        title,
        description: description || undefined,
        language,
        visibility,
      });
      router.push(`/sets/${set.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-text-dark">Create a flashcard set</h1>
      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-dark" htmlFor="title">
                Title
              </label>
              <Input
                id="title"
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Spanish Basics"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-dark" htmlFor="description">
                Description
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this set about?"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-dark" htmlFor="language">
                Danh mục
              </label>
              <Select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as SetLanguage)}
              >
                {(Object.keys(SET_LANGUAGE_LABELS) as SetLanguage[]).map((value) => (
                  <option key={value} value={value}>
                    {SET_LANGUAGE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-dark" htmlFor="visibility">
                Visibility
              </label>
              <Select
                id="visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as SetVisibility)}
              >
                <option value="private">Private — only you</option>
                <option value="unlisted">Unlisted — anyone with the link</option>
                <option value="public">Public — discoverable in Explore</option>
              </Select>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button type="submit" disabled={submitting || !title}>
              {submitting ? "Creating..." : "Create set"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
