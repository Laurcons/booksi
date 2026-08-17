import type { Book } from "@bookcsi/shared";
import { useDeleteBook } from "../../api/books";
import { Modal } from "../Modal";

/**
 * S1.3 — deletion asks first. It is permanent and it is one click away from an
 * ordinary row, so the confirmation names the book: "sigur ștergi?" on its own
 * is a question about nothing in particular.
 */
export function DeleteBookDialog({
  book,
  onClose,
  onDeleted,
}: {
  book: Book;
  onClose: () => void;
  /**
   * What to do once the book is actually gone, for callers that need to tell
   * the two endings apart. A listing does not: cancelling and deleting both
   * end with the dialog closing over a list that refetches itself. The book's
   * own page does — it cannot stay on a profile whose book no longer exists,
   * so it navigates away instead of closing (§D41).
   */
  onDeleted?: () => void;
}) {
  const remove = useDeleteBook();

  return (
    <Modal title="Ștergi cartea?" onClose={onClose}>
      <div className="px-6 py-5">
        <p className="text-sm text-ink-2">
          <span className="text-ink">„{book.title}"</span>
          {book.author && <span className="text-ink-3"> de {book.author}</span>} se
          șterge definitiv, împreună cu datele de lectură. Nu se poate anula.
        </p>

        {remove.error && (
          <p role="alert" className="mt-4 text-sm text-status-abandoned">
            Nu am putut șterge: {remove.error.message}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        >
          Renunță
        </button>
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(book.id, { onSuccess: onDeleted ?? onClose })
          }
          className="rounded-lg border border-status-abandoned/40 px-4 py-2 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-status-abandoned hover:text-ink disabled:opacity-60"
        >
          {remove.isPending ? "Se șterge…" : "Șterge definitiv"}
        </button>
      </div>
    </Modal>
  );
}
