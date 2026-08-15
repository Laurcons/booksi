import { useState } from "react";
import { useCreateChallenge } from "../../api/challenges";
import { Modal } from "../Modal";

const INPUT =
  "w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent";

/** The empty-state flow: title and a deadline are all a challenge needs to
 * exist. Books are added afterwards, from the page it just opens onto — a
 * second, smaller form here asking to pick books before the challenge is
 * even real would be the wizard-section machinery Kobo's static HTML needs
 * and this page, with real interactivity, does not. */
export function CreateChallengeDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateChallenge();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

  const valid = title.trim() !== "" && deadline !== "";

  const submit = async () => {
    if (!valid) {
      return;
    }

    await create.mutateAsync({
      title: title.trim(),
      description: description.trim() === "" ? undefined : description.trim(),
      deadline,
    });

    onClose();
  };

  return (
    <Modal title="Provocare nouă" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <div className="flex flex-col gap-4 px-6 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">Titlu</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Provocarea de vară"
              className={INPUT}
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">Descriere (opțional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">Termen</span>
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className={INPUT}
            />
          </label>
        </div>

        {create.error && (
          <p role="alert" className="px-6 pb-2 text-sm text-status-abandoned">
            Nu am putut salva: {create.error.message}
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
            disabled={create.isPending || !valid}
            className="rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60"
          >
            {create.isPending ? "Se creează…" : "Creează"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
