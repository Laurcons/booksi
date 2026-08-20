import {
  statusLabel,
  STATUS_VALUES,
  type ListBooksQuery,
  type Status,
} from "@bookcsi/shared";
import { isFiltered } from "../../lib/filters";
import { BookSearch } from "./BookSearch";
import { CategoryPicker } from "./CategoryPicker";
import { useLocale } from "../../i18n/locale-context";
import { useT } from "../../i18n/locale-context";

/**
 * S5.3 — status (multi-select), genre and favourites, combined with AND.
 *
 * The filters live in the query object the page sends to the API rather than in
 * a `filter()` over the loaded list: §D29, and the same reasoning S3.1 was
 * written with — a list narrowed by one rule sitting under a total computed by
 * another is how the two quietly stop agreeing.
 *
 * An unticked filter is an **absent** parameter, never an empty one. Sending
 * `status=[]` would ask the API for the books whose status is one of none, and
 * an empty gallery is indistinguishable from data loss.
 */
export function GalleryFilters({
  query,
  onChange,
  search,
  onSearchChange,
}: {
  query: ListBooksQuery;
  onChange: (query: ListBooksQuery) => void;
  /**
   * §D42 — the text as typed, which the panel shows but does not own. The
   * query below carries the *debounced* value, and "Șterge filtrele" has to
   * empty the box as well as the search, so both live with the page.
   */
  search: string;
  onSearchChange: (search: string) => void;
}) {
  const t = useT();
  const { locale } = useLocale();

  const statuses = query.status ?? [];
  const filtering = isFiltered(query);

  const toggleStatus = (status: Status) => {
    const next = statuses.includes(status)
      ? statuses.filter((value) => value !== status)
      : [...statuses, status];

    onChange({ ...query, status: next.length === 0 ? undefined : next });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-1 px-5 py-4">
      {/* First in the strip: search is the widest net, and the toggles below
          narrow whatever it returns. */}
      <BookSearch
        value={search}
        onChange={onSearchChange}
        className="w-full sm:max-w-md"
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterLabel>{t("field.status")}</FilterLabel>

        {STATUS_VALUES.map((status) => (
          <Toggle
            key={status}
            pressed={statuses.includes(status)}
            onClick={() => toggleStatus(status)}
          >
            {statusLabel(status, locale)}
          </Toggle>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterLabel>{t("field.category")}</FilterLabel>

        {/* §D45 — a set now, matched with OR: ticking two shelves shows books on
            either. An empty set drops the parameter (§D29), like status. */}
        <div className="min-w-56 flex-1">
          <CategoryPicker
            ariaLabel={t("field.category")}
            value={query.category ?? []}
            className="w-full rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-2 transition-colors duration-150 hover:border-accent-quiet"
            onChange={(category) =>
              onChange({ ...query, category: category.length === 0 ? undefined : category })
            }
          />
        </div>

        <Toggle
          pressed={query.favorite === true}
          onClick={() =>
            onChange({ ...query, favorite: query.favorite === true ? undefined : true })
          }
        >
          ★ Doar favoritele
        </Toggle>

        {filtering && (
          <button
            type="button"
            onClick={() => {
              onChange({
                ...query,
                status: undefined,
                category: undefined,
                favorite: undefined,
                q: undefined,
              });
              // The box too, not just the query: clearing one and leaving the
              // other shows a search that is no longer being applied.
              onSearchChange("");
            }}
            className="ml-auto text-sm text-ink-3 underline-offset-4 transition-colors duration-150 hover:text-ink-2 hover:underline"
          >
            {t("filters.clear")}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
      {children}
    </span>
  );
}

/**
 * A pressed state, not a checkbox: these are filters the user flips on and off,
 * and `aria-pressed` says exactly that without a label going stale.
 */
function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        "rounded-lg border px-2.5 py-1.5 text-sm transition-colors duration-150 " +
        (pressed
          ? "border-accent-quiet bg-accent-quiet/40 text-accent"
          : "border-line text-ink-2 hover:border-accent-quiet hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
