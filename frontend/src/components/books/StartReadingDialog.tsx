import { useState } from "react";
import type { Book } from "@bookcsi/shared";
import { useUpdateBook } from "../../api/books";
import { Modal } from "../Modal";

/**
 * S2.2 — "when a book moves to `Citesc`, ask for the page count once, and let
 * it be skipped".
 *
 * Asked *here*, at the transition, because that is the one moment the number is
 * worth something: without it the book will show "pag. 143" for the whole read
 * (§D4) and contribute nothing to a progress bar. Asked *once* because §D4 is
 * explicit that a missing page count is the normal case for non-English
 * editions, and a prompt that returns on every visit would be punishing the
 * user for a gap in Open Library's data.
 *
 * Skipping is a first-class outcome, not a cancel: the status change happens
 * either way. Only the page count is optional — which is why the quiet button
 * still saves and the dialog cannot be left without the book being READING.
 */
export function StartReadingDialog({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const update = useUpdateBook();
  const [totalPages, setTotalPages] = useState("");

  const parsed = Number(totalPages);
  const valid = totalPages.trim() !== "" && Number.isInteger(parsed) && parsed > 0;

  const start = async (withPageCount: boolean) => {
    await update.mutateAsync({
      id: book.id,
      input: {
        status: "READING",
        ...(withPageCount && valid ? { totalPages: parsed } : {}),
      },
    });

    onClose();
  };

  return (
    <Modal
      title="Câte pagini are?"
      description="Ca să-ți pot arăta cât ai citit din ea. Poți sări peste."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void start(true);
        }}
        noValidate
      >
        <div className="px-6 py-5">
          <p className="mb-4 text-sm text-ink-2">
            „{book.title}" trece la <span className="text-ink">Citesc</span>.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">Nr. de pagini</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={totalPages}
              onChange={(event) => setTotalPages(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-accent"
              aria-label="Nr. de pagini"
            />
          </label>

          <p className="mt-2 text-xs text-ink-3">
            Fără el, progresul se arată ca „pag. 143", fără procent.
          </p>
        </div>

        {update.error && (
          <p role="alert" className="px-6 pb-2 text-sm text-status-abandoned">
            Nu am putut salva: {update.error.message}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
          {/* Skipping still starts the book — that is the whole point. */}
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => void start(false)}
            className="rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink disabled:opacity-60"
          >
            Sari peste
          </button>
          <button
            type="submit"
            disabled={update.isPending || !valid}
            className="rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60"
          >
            {update.isPending ? "Se salvează…" : "Salvează și începe"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
