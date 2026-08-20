import { z } from "zod";
import { type Locale } from "./locale.js";

/**
 * These mirror the Prisma enums exactly. They live here rather than being
 * imported from `@prisma/client` so the frontend never has to depend on the
 * ORM, and so a divergence shows up as a type error on the next build.
 *
 * §D45 note: `Genre` used to live here too — a 29-value enum with a
 * compile-time `Record<Locale, Record<Genre, string>>` label map. It became a
 * database-backed taxonomy (`shared/src/category.ts`, docs/DECISIONS.md §D45),
 * so the only controlled vocabulary left in this file is `Status`.
 */

export const STATUS_VALUES = [
  "WISHLIST",
  "PURCHASED",
  "READING",
  "FINISHED",
  "ABANDONED",
] as const;

export const statusSchema = z.enum(STATUS_VALUES);
export type Status = z.infer<typeof statusSchema>;

/**
 * One label per language (§D44). Written as a map rather than folded into
 * `messages.ts` so a label stays next to the value it labels: adding a status
 * and forgetting to name it is a type error in the same file.
 */
export const STATUS_LABELS: Record<Locale, Record<Status, string>> = {
  ro: {
    WISHLIST: "Wishlist",
    PURCHASED: "Cumpărat",
    READING: "Citesc",
    FINISHED: "Terminat",
    ABANDONED: "Abandonat",
  },
  en: {
    WISHLIST: "Wishlist",
    PURCHASED: "Purchased",
    READING: "Reading",
    FINISHED: "Finished",
    ABANDONED: "Abandoned",
  },
};

/**
 * The lookup as a function, because that is how every call site reads it — one
 * status, one language — and because a nested subscript at the point of use
 * (`STATUS_LABELS[locale][status]`) puts the two indices in the opposite order
 * from the question being asked.
 */
export function statusLabel(status: Status, locale: Locale): string {
  return STATUS_LABELS[locale][status];
}
