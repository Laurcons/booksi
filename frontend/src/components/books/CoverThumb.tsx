import { apiImageSrc, CREDENTIALED_IMAGE } from "../../lib/media";
import { CoverPlaceholder } from "./CoverPlaceholder";

/**
 * S1.2's cover column, which from Sprint 4 has something to put in it.
 *
 * The placeholder is not a fallback for a failed load — it is what a book
 * without a cover looks like, and S5.5 draws it (see `CoverPlaceholder`, shared
 * with the gallery card so the two cannot drift apart).
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

  if (src === null) {
    return <CoverPlaceholder title={title} variant="thumb" />;
  }

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
