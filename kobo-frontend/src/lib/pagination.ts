/**
 * §Paginare (docs/kobo_design.md) — fișe per page, no infinite scroll, and no
 * server-side page parameter: `GET /books` already returns the whole library
 * in one response (§D29's reasoning for wishlist/gallery filters applies the
 * same way here), so the page is a slice taken here, not a query.
 *
 * The count is sized to fit one 1264px-tall viewport without scrolling at
 * all — the newer, stricter reading of §Paginare, now that tapping is the
 * only way to move between screens. It is arithmetic, not a measurement: a
 * fișă row is dominated by its 130px cover, so five rows plus the page's own
 * heading, "add a book" button, and a pager top and bottom come to roughly
 * the full viewport height. It has not been checked against real text
 * wrapping on the device, so treat it the same way as `PX_PER_INCH` — a
 * first estimate, correct it after looking at a real page.
 */
export const BOOKS_PER_PAGE = 5;

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/**
 * `page` is clamped into range rather than rejected — a bookmarked or
 * hand-typed `?page=` past the end is a normal thing to happen once a library
 * shrinks, and landing on the last real page beats a blank one.
 */
export function paginate<T>(all: T[], requestedPage: number, pageSize = BOOKS_PER_PAGE): Page<T> {
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), totalPages);
  const start = (page - 1) * pageSize;

  return { items: all.slice(start, start + pageSize), page, totalPages };
}
