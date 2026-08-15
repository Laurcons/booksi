import { useState } from "react";
import type { Book } from "@bookcsi/shared";
import { useUpdateBook } from "../../api/books";
import { Modal } from "../Modal";
import { StarRatingInput } from "../books/StarRating";

/**
 * The bundling the design conversation asked for: finishing a book from the
 * challenge page asks for a rating in the same step, rather than the two
 * separate actions the rest of the app uses (a one-click status change on the
 * row, rating left for the edit form). A challenge's whole point is a moment
 * of closure per book — asking once, right there, is worth the extra click
 * `BookTable`'s plain "Am terminat-o" doesn't take.
 *
 * The API already accepts `status` and `rating` in the same `PATCH`
 * (`BooksController`'s own doc: "Aceeași cerere poate trimite statusul și
 * ratingul deodată"), so this is one `useUpdateBook` call, not two.
 *
 * Rating is skippable, same convention as `StartReadingDialog`'s page count:
 * the status change is the one thing that must happen, the rating is a bonus
 * the form makes easy to skip rather than easy to forget entirely.
 */
export function FinishChallengeBookDialog({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const update = useUpdateBook();
  const [rating, setRating] = useState("");

  const finish = async () => {
    await update.mutateAsync({
      id: book.id,
      input: {
        status: "FINISHED",
        ...(rating === "" ? {} : { rating: Number(rating) }),
      },
    });

    onClose();
  };

  return (
    <Modal title="Ai terminat-o?" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void finish();
        }}
        noValidate
      >
        <div className="px-6 py-5">
          <p className="mb-4 text-sm text-ink-2">
            „{book.title}" trece la <span className="text-ink">Terminat</span>.
          </p>

          <span className="mb-1.5 block text-sm text-ink-2">Notă (opțional)</span>
          <StarRatingInput
            name="rating"
            value={rating}
            disabled={update.isPending}
            onChange={(event) => setRating(event.target.value)}
          />
        </div>

        {update.error && (
          <p role="alert" className="px-6 pb-2 text-sm text-status-abandoned">
            Nu am putut salva: {update.error.message}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
          >
            Renunță
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60"
          >
            {update.isPending ? "Se salvează…" : "Marchează terminată"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
