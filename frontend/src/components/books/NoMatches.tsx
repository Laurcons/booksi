import { useT } from "../../i18n/locale-context";

/**
 * The other kind of empty — the list is short because the user narrowed it,
 * not because the library is.
 *
 * Telling the two apart is the whole point (§D29): an empty library needs a
 * first book, and `EmptyLibrary` offers one. A library that is merely filtered
 * or searched needs its books back, and "încă n-ai nicio carte" is simply
 * false there — its button would not even return them.
 *
 * Lifted out of `GalleryPage`, where it lived inline while the gallery was the
 * only screen that could narrow anything. Search (§D42) put the same state on
 * the library and the wishlist, and three copies of it would have drifted.
 */
export function NoMatches({
  searching,
  onClear,
}: {
  /** Whether a search — rather than only a filter — is what emptied the list. */
  searching: boolean;
  onClear: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">{t("noMatches.title")}</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        {/* Naming the likeliest cause beats a generic "try again": every word
            typed has to match something, so one word too many is the usual way
            a search that should have worked comes back empty. */}
        {searching ? t("noMatches.search") : t("noMatches.filters")}
      </p>
      {/* Deliberately not the same words as the filter strip's own reset: two
          buttons reading "Șterge filtrele" on one screen is a puzzle, and this
          one can afford to say what the user gets. */}
      <button
        type="button"
        onClick={onClear}
        className="mt-6 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
      >
        {t("noMatches.showAll")}
      </button>
    </div>
  );
}
