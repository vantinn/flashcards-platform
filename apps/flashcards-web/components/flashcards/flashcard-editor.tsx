"use client";

import { useRef, useState, type FormEvent } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, ApiError } from "@/lib/api-client";
import type { Flashcard } from "@/types/flashcard";

export interface FlashcardEditorProps {
  setId: string;
  initialCards: Flashcard[];
}

export function FlashcardEditor({ setId, initialCards }: FlashcardEditorProps) {
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [error, setError] = useState<string | null>(null);

  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Flashcard | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const newFrontRef = useRef<HTMLTextAreaElement>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const card = await api.post<Flashcard>(`/flashcard-sets/${setId}/cards`, {
        front: newFront,
        back: newBack,
      });
      setCards((current) => [...current, card]);
      setNewFront("");
      setNewBack("");
      // Sending several cards in a row is the common case (e.g. building a
      // 10-card set) — hand focus straight back to Front instead of making
      // every card require a re-click into the form.
      newFrontRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this card.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(cardId: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<Flashcard>(`/flashcards/${cardId}`, {
        front: editFront,
        back: editBack,
      });
      setCards((current) => current.map((card) => (card.id === cardId ? updated : card)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this card.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/flashcards/${deleteTarget.id}`);
      setCards((current) => current.filter((card) => card.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this card.");
    } finally {
      setDeleting(false);
    }
  }

  async function duplicateCard(card: Flashcard) {
    setDuplicatingId(card.id);
    setError(null);
    try {
      const updated = await api.post<Flashcard[]>(`/flashcards/${card.id}/duplicate`);
      setCards(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not duplicate this card.");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= cards.length) return;

    const reordered = [...cards];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setCards(reordered);
    setReorderingId(reordered[targetIndex].id);
    setError(null);

    try {
      const saved = await api.patch<Flashcard[]>(`/flashcard-sets/${setId}/cards/reorder`, {
        cardIds: reordered.map((card) => card.id),
      });
      setCards(saved);
    } catch (err) {
      setCards(cards); // revert the optimistic swap
      setError(err instanceof ApiError ? err.message : "Could not reorder cards.");
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold text-text-dark">Add a card</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-front" className="text-xs font-medium text-text-muted">
                Front
              </label>
              <Textarea
                id="new-front"
                ref={newFrontRef}
                required
                value={newFront}
                onChange={(event) => setNewFront(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-back" className="text-xs font-medium text-text-muted">
                Back
              </label>
              <Textarea
                id="new-back"
                required
                value={newBack}
                onChange={(event) => setNewBack(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={adding || !newFront || !newBack}>
                {adding ? "Adding..." : "Add card"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {cards.length === 0 ? (
        <EmptyState title="No cards yet" description="Add your first card above." />
      ) : (
        <ol className="flex flex-col gap-3">
          {cards.map((card, index) => (
            <li key={card.id}>
              <Card className={reorderingId === card.id ? "opacity-60" : undefined}>
                <CardBody>
                  {editingId === card.id ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Textarea value={editFront} onChange={(event) => setEditFront(event.target.value)} />
                        <Textarea value={editBack} onChange={(event) => setEditBack(event.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(card.id)} disabled={saving}>
                          {saving ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col gap-1 pt-1">
                        <button
                          type="button"
                          aria-label="Move card up"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-card text-text-muted hover:bg-black/5 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Move card down"
                          onClick={() => move(index, 1)}
                          disabled={index === cards.length - 1}
                          className="flex h-7 w-7 items-center justify-center rounded-card text-text-muted hover:bg-black/5 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>

                      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                        <p className="text-text-dark">{card.front}</p>
                        <p className="text-text-dark">{card.back}</p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(card)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => duplicateCard(card)}
                          disabled={duplicatingId === card.id}
                        >
                          {duplicatingId === card.id ? "Duplicating..." : "Duplicate"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(card)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this card?"
        description="This card will be permanently removed from the set."
        confirmLabel="Delete card"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
