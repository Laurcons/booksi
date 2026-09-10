import { useT } from "../../../i18n/locale-context";
import { AuthorPicker } from "../AuthorPicker";
import { Field } from "./fields";
import type { AuthorSelection } from "./use-author-selection";

/**
 * §D51 — the author field, on both of the tabs that want it.
 *
 * It is the same control in both places, bound to the same form value, and the
 * duplication is deliberate:
 *
 * - On **Carte** it belongs to the identity block — cover, title, author, ISBN
 *   is how a book introduces itself, and the author is the next thing you know
 *   after the title. It is also where the Open Library fill and the barcode
 *   scan put an author, and until now the reader had to leave the tab to see
 *   what their own action had done.
 * - On **Autor** it sits above the biography, because the moment you notice you
 *   are reading the wrong person's prose is the moment you want to change who
 *   it is about. Sending the reader to another tab for that would be the worse
 *   half of the trade.
 *
 * §D51 originally moved the author off the Carte tab altogether, and the
 * argument for that has been narrowed rather than reversed: what needed a tab
 * of its own was the **biography** — prose in a grid of values is what §D48
 * split this form up to stop — and that was never a reason for the picker to
 * leave with it.
 *
 * Only the active tab is mounted, so the two copies are never on screen at
 * once. The behaviour behind them lives in `useAuthorSelection`, so it cannot
 * drift between them; distinct `inputId`s keep each label pointing at its own
 * control regardless.
 */
export function AuthorField({
  selection,
  inputId,
  error,
}: {
  selection: AuthorSelection;
  inputId: string;
  error?: { message?: string };
}) {
  const t = useT();

  return (
    <Field label={t("field.author")} htmlFor={inputId} error={error}>
      <AuthorPicker
        inputId={inputId}
        value={selection.value}
        onChange={selection.pick}
        onCreate={selection.create}
        onDelete={selection.remove}
      />
    </Field>
  );
}
