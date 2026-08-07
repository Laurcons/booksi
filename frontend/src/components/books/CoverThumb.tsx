import { apiImageSrc, CREDENTIALED_IMAGE } from "../../lib/media";

/**
 * S1.2's cover column, which from Sprint 4 has something to put in it.
 *
 * The placeholder is not a fallback for a failed load — it is what a book
 * without a cover looks like, and it stays the majority case: §D4's missing
 * page counts and Open Library's missing jackets travel together. docs/DESIGN.md
 * §Placeholderul asks for a drawn cover rather than a broken-image icon —
 * surface-3, a thin brass inner rule, serif lettering — so that a table full of
 * them reads as a shelf of unjacketed books. At 32×48 the title does not fit,
 * so the initial stands in for it; the large variant with title and author is
 * S5.5, for the grid.
 */
export function CoverThumb({
  title,
  coverUrl = null,
}: {
  title: string;
  /** `Book.coverUrl` — a path on the API, version included (§D26). */
  coverUrl?: string | null;
}) {
  const src = apiImageSrc(coverUrl);

  if (src !== null) {
    return (
      <img
        {...CREDENTIALED_IMAGE}
        src={src}
        // The title is already the next cell along; announcing it twice makes
        // a screen reader read every row's book name two times.
        alt=""
        loading="lazy"
        className="h-12 w-8 shrink-0 rounded-[2px] object-cover"
      />
    );
  }

  const initial = title.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      aria-hidden
      className="grid h-12 w-8 shrink-0 place-items-center rounded-[2px] bg-surface-3 p-[3px]"
    >
      <span className="grid size-full place-items-center rounded-[1px] border border-accent/30 font-display text-sm text-ink-2">
        {initial}
      </span>
    </span>
  );
}
