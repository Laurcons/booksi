import { useState } from "react";
import type { Book, Challenge } from "@bookcsi/shared";
import {
  useAddChallengeBook,
  useDeleteChallenge,
  useRemoveChallengeBook,
  useUpdateChallenge,
} from "../../api/challenges";
import { BookSelector } from "../books/BookSelector";
import { Modal } from "../Modal";
import { useT } from "../../i18n/locale-context";

const INPUT =
  "w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent";

/**
 * Title, description, deadline, and book membership — the three "for
 * reference" asks that don't reuse `BookFormDialog`, because none of them are
 * about a book. Membership uses `BookSelector` (`components/books/`), which
 * knows nothing about challenges itself — this dialog is the thing that
 * decides a check means "attach" and an uncheck means "detach", through the
 * same dedicated routes `/books/{id}/purchase` uses instead of a generic
 * `PATCH`, so toggling a book here never risks touching the book itself.
 */
export function ChallengeEditDialog({
  challenge,
  onClose,
  onDeleted,
}: {
  challenge: Challenge;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const update = useUpdateChallenge();
  const remove = useDeleteChallenge();
  const addBook = useAddChallengeBook();
  const removeBook = useRemoveChallengeBook();

  const [title, setTitle] = useState(challenge.title);
  const [description, setDescription] = useState(challenge.description ?? "");
  const [deadline, setDeadline] = useState(challenge.deadline);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const memberIds = new Set(challenge.books.map((b) => b.id));

  const toggleBook = (book: Book) => {
    if (memberIds.has(book.id)) {
      removeBook.mutate({ challengeId: challenge.id, bookId: book.id });
    } else {
      addBook.mutate({ challengeId: challenge.id, bookId: book.id });
    }
  };

  const valid = title.trim() !== "" && deadline !== "";

  const save = async () => {
    if (!valid) {
      return;
    }

    await update.mutateAsync({
      id: challenge.id,
      input: {
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
        deadline,
      },
    });

    onClose();
  };

  return (
    <Modal title={t("challenge.edit")} onClose={onClose} wide>
      <div className="flex flex-col gap-4 px-6 py-5">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">{t("field.title")}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">{t("field.description")}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className={INPUT}
          />
        </label>

        <label className="block max-w-xs">
          <span className="mb-1.5 block text-sm text-ink-2">{t("field.deadline")}</span>
          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className={INPUT}
          />
        </label>

        {update.error && (
          <p role="alert" className="text-sm text-error">
            Nu am putut salva: {update.error.message}
          </p>
        )}

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-sm text-ink-2">
            {challenge.books.length === 0
              ? t("challenge.noBooksYet")
              : t("challenge.bookTally", { count: challenge.books.length })}
          </p>

          <BookSelector selectedIds={memberIds} onToggle={toggleBook} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        {confirmingDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-2">{t("challenge.deleteTitle")}</span>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-sm text-ink-3 hover:text-ink-2"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate(challenge.id, { onSuccess: onDeleted })}
              className="rounded-lg border border-status-abandoned/40 px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-status-abandoned hover:text-ink disabled:opacity-60"
            >
              {remove.isPending ? t("common.deleting") : t("common.delete")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-sm text-ink-3 transition-colors duration-150 hover:text-status-abandoned"
          >
            {t("challenge.delete")}
          </button>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
          >
            {t("common.close")}
          </button>
          <button
            type="button"
            disabled={update.isPending || !valid}
            onClick={() => void save()}
            className="rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60"
          >
            {update.isPending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
