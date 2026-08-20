import { useT } from "../../i18n/locale-context";

/**
 * A library with nothing in it yet, on whichever screen the user landed on
 * first. Shared by the table (S1.2) and the gallery (S5.1) rather than written
 * twice: the same absence, and the same way out of it.
 *
 * Distinct from the gallery's *filtered* empty state on purpose. "Încă n-ai
 * nicio carte" is simply false when the library is full and the filters are
 * merely too narrow, and it offers the wrong button — adding a book does not
 * make a filtered view any less empty (§D29).
 */
export function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">{t("empty.library.title")}</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        {t("empty.library.body")}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
      >
        {t("nav.addBook")}
      </button>
    </div>
  );
}
