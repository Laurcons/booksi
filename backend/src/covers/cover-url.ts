/**
 * Where a book's cover is served from, version and all.
 *
 * A plain function rather than a service method because two places need the
 * answer and neither should own it: `BooksService` puts it on every book it
 * returns, and `CoversService` reports it back after an upload.
 *
 * **The query string is the load-bearing part.** ARCHITECTURE.md serves the
 * image with `Cache-Control: public, max-age=31536000, immutable`, on the
 * premise that a book's cover never changes after it is added. S4.3's upload
 * is exactly that premise failing: replace a cover and the browser, correctly
 * obeying `immutable`, keeps the old one for a year. Moving the version with
 * the image means a replacement is simply a URL nothing has cached — which is
 * the standard way out, and cheaper than weakening the caching for everyone to
 * accommodate a case that happens once per book at most.
 */
export function coverUrl(bookId: string, version: Date): string {
  return `/covers/${bookId}?v=${version.getTime()}`;
}
