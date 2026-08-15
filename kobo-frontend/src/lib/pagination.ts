/**
 * §Paginare (docs/kobo_design.md) — fișe per page, no infinite scroll, and no
 * server-side page parameter: `GET /books` already returns the whole library
 * in one response (§D29's reasoning for wishlist/gallery filters applies the
 * same way here), so the page is a slice taken here, not a query.
 *
 * The count is sized to fit one 1264px-tall viewport without scrolling at
 * all — the newer, stricter reading of §Paginare, now that tapping is the
 * only way to move between screens. It is a real rendered measurement, not
 * arithmetic: the Playwright Kobo harness emulates the 1212×1264px panel
 * (DPR 1 and the Kobo Touch User-Agent) with long realistic book content.
 *
 * Two bugs hid most of the real budget until they were found by checking
 * actual element positions, not just a screenshot: `.header-main` and the
 * dashboard's combined width left no room for the space character a browser
 * inserts between adjacent `inline-block` tags in the HTML source, and
 * `.cover` had no `box-sizing: border-box`, so its border made it 4px wider
 * than `.book-info`'s width calculation assumed. Both silently wrapped their
 * pair onto two rows instead of laying it out side by side — see
 * `books-list.ts`'s comments on the array-join fix and `box-sizing` for the
 * detail. Once actually side by side, `books-list.ts`'s own 0.75× page-local
 * type scale (floored at `fontSize.floor`) shrank every row further.
 *
 * With both wrapping bugs fixed, `.btn` and the nav band also dropped to
 * `fontSize.meta` (page.ts) — they were sized for `fontSize.body` inside a
 * touch target whose floor is `min-height`/`min-width` (§Geometrie's 9mm),
 * not the font, so the text had been bigger than the constraint that
 * actually mattered required. That shrink applies everywhere `.btn`/the nav
 * band appear, not just this page, and freed more of this page's budget too.
 *
 * The metadata grew a second line after that (genre, price, page count —
 * `bookExtras()` in `books-list.ts`) rather than staying crammed onto the
 * first one, and the row gap widened from a near-zero 6px to 9px now that
 * there was room. Both cost real height (going from one dense line to two is
 * not free the way adding fields to an already-cover-dominated single line
 * was).
 *
 * Then the cards went two per row (`.book-card`, 48%+48% with 4% real slack —
 * see the two wrapping bugs above for why that slack isn't optional). Title
 * switched from a two-line clamp to single-line ellipsis truncation for
 * this: two cards on one visual row with different wrap heights leave a
 * ragged gap under the shorter one, since plain `inline-block` has no way to
 * equalise row heights the way `grid` would, and truncation is what keeps
 * every card the same height instead. Real titles rarely hit the ellipsis —
 * only the fixture's deliberately extreme one does.
 *
 * Five or six worst-case cards round up to the same 3 grid rows, which was
 * enough to make `BOOKS_PER_PAGE = 5` look free — it wasn't a real ceiling,
 * just a rounding coincidence, caught by extending the e2e fixtures past a
 * single leftover book (`PAGE_TWO_BOOKS` in `e2e/fixtures.ts`) rather than
 * trusting a count that happened to round the same as a smaller one. Eight
 * cards (4 rows) render to 1097.1px, 166.9px of headroom. Ten (5 rows)
 * render to 1241.1px, only 22.9px — thinner than anywhere else this budget
 * has been left, so 8 is the value kept, not 10. Keep this tied to the
 * harness rather than guessing, verify with real element coordinates
 * (`getBoundingClientRect()`), and test past whatever count merely happens
 * to fit in the current fixtures — a row-count budget needs one more row of
 * data than looks necessary, or a rounding coincidence reads as a margin.
 */
export const BOOKS_PER_PAGE = 8;

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
