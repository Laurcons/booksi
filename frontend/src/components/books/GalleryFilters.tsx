import { STATUS_LABEL, STATUS_VALUES, type ListBooksQuery, type Status } from "@bookcsi/shared";
import { isFiltered } from "../../lib/filters";
import { CategoryPicker } from "./CategoryPicker";

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
}: {
  query: ListBooksQuery;
  onChange: (query: ListBooksQuery) => void;
}) {
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
      <div className="flex flex-wrap items-center gap-2">
        <FilterLabel>Status</FilterLabel>

        {STATUS_VALUES.map((status) => (
          <Toggle
            key={status}
            pressed={statuses.includes(status)}
            onClick={() => toggleStatus(status)}
          >
            {STATUS_LABEL[status]}
          </Toggle>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterLabel>Categorie</FilterLabel>

        {/* One value, not a set: a book has exactly one category (§D17), and
            a multi-select here would advertise a data model that does not
            exist. */}
        <CategoryPicker
          ariaLabel="Categorie"
          value={query.genre ?? ""}
          clearLabel="Toate categoriile"
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-2 transition-colors duration-150 hover:border-accent-quiet"
          onChange={(genre) =>
            onChange({ ...query, genre: genre === "" ? undefined : genre })
          }
        />

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
            onClick={() =>
              onChange({
                ...query,
                status: undefined,
                genre: undefined,
                favorite: undefined,
              })
            }
            className="ml-auto text-sm text-ink-3 underline-offset-4 transition-colors duration-150 hover:text-ink-2 hover:underline"
          >
            Șterge filtrele
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
