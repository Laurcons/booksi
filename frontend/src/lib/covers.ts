import type { Book } from "@bookcsi/shared";

/**
 * A book together with a cover to draw.
 *
 * The API's `Book` has no cover field and should not: §D18 makes the cover a
 * separate row with a blob in it, served from its own route so that listing a
 * library does not carry one per line. What the screens that *show* a cover
 * need is a URL, which is a view concern rather than part of the book.
 *
 * Sprint 4 fills this in from `/books/{id}/cover`. Until then it is what the
 * shelf (S8.2) and the reading strip are designed against, and stating it as a
 * type keeps those two honest about the one field they need that the API does
 * not yet give them.
 */
export type BookWithCover = Book & { cover: string | null };
