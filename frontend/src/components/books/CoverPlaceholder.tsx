/**
 * S5.5 — what a book without a cover looks like. Not a fallback for a failed
 * load, and not a broken-image icon: docs/DESIGN.md §Placeholderul asks for a
 * cover we draw ourselves — `surface-3`, a thin brass inner rule, serif
 * lettering — because §D4's missing page counts and Open Library's missing
 * jackets travel together, so this stays the majority case rather than the
 * exception. In a grid, dozens of empty grey rectangles would wreck the shelf.
 *
 * Two sizes, one drawing. The `thumb` variant is the table's, and at 32×48 no
 * title fits, so the initial stands in for it; the `card` variant is the
 * gallery's, where the whole point is that the book stays identifiable without
 * a jacket, so it carries the title and the author.
 */
export function CoverPlaceholder({
  title,
  author = null,
  variant,
}: {
  title: string;
  /** Shown on the card variant only — there is no room for it at 32×48. */
  author?: string | null;
  variant: "thumb" | "card";
}) {
  const thumb = variant === "thumb";

  return (
    <span
      // Decorative: the title is written beside it in the table and beneath it
      // on the card, so a screen reader announcing this too would say the book
      // twice.
      aria-hidden
      className={
        "grid shrink-0 place-items-center bg-surface-3 " +
        (thumb ? "h-12 w-8 rounded-[2px] p-[3px]" : "size-full p-3")
      }
    >
      <span
        className={
          "grid size-full place-items-center border border-accent/30 text-center " +
          (thumb ? "rounded-[1px]" : "rounded-[2px] px-2")
        }
      >
        {thumb ? (
          <span className="font-display text-sm text-ink-2">{initial(title)}</span>
        ) : (
          <span className="flex flex-col gap-1.5">
            {/* Playfair here and Inter for the card's real title below is not
                an inconsistency: this is standing in for a printed jacket. */}
            <span className="line-clamp-4 font-display text-lg leading-snug text-ink-2">
              {title}
            </span>
            {author !== null && (
              <span className="line-clamp-2 text-xs text-ink-3">{author}</span>
            )}
          </span>
        )}
      </span>
    </span>
  );
}

/** The `?` is for a title that is all whitespace — the API allows none. */
function initial(title: string): string {
  return title.trim().charAt(0).toUpperCase() || "?";
}
