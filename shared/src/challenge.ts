import { z } from "zod";
import { bookSchema, calendarDateSchema, nullableText } from "./book.js";

/**
 * Backs `frontend/src/pages/ChallengePage.tsx`, which started as a
 * local-state-only mock and gets a real entity here: a curated set of books
 * against a deadline. `deadline` is a calendar day, not an instant, for the
 * same reason `book.ts`'s status dates are — "ends August 31st" must not
 * depend on which side of UTC midnight the reader happens to be on.
 */
export const challengeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  deadline: calendarDateSchema,

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),

  /** Full rows, current status and all — the shelf and the book list both
   * render straight off this without a second fetch per book. */
  books: z.array(bookSchema),
});

export type Challenge = z.infer<typeof challengeSchema>;

/**
 * The list shape. A challenge's own fields plus two counts rather than the
 * full `books` array — a list of many challenges paying for every member
 * book's full row each would be the same mistake §D18 already ruled out for
 * covers on the book list.
 */
export const challengeSummarySchema = challengeSchema.omit({ books: true }).extend({
  bookCount: z.number().int(),
  finishedCount: z.number().int(),
});

export type ChallengeSummary = z.infer<typeof challengeSummarySchema>;

export const createChallengeSchema = z.strictObject({
  title: z.string().trim().min(1, "Titlul e obligatoriu").max(255),
  description: nullableText(2000).optional(),
  deadline: calendarDateSchema,

  /** Optional: a challenge can start empty and have books attached after,
   * through the dedicated attach route. */
  bookIds: z.array(z.string()).max(200).optional(),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

/** Every field editable at any time, same convention as `updateBookSchema`.
 * Book membership is not here — see `addChallengeBookSchema` below and the
 * dedicated attach/detach routes, which mirror `/books/{id}/purchase` getting
 * its own route instead of being folded into a generic `PATCH`. */
export const updateChallengeSchema = z.strictObject({
  title: z.string().trim().min(1, "Titlul e obligatoriu").max(255).optional(),
  description: nullableText(2000).optional(),
  deadline: calendarDateSchema.optional(),
});

export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;

export const addChallengeBookSchema = z.strictObject({
  bookId: z.string().min(1),
});

export type AddChallengeBookInput = z.infer<typeof addChallengeBookSchema>;
