/**
 * Contracts shared by the API and the web client, so that a DTO is defined
 * once instead of twice. Nest validates with these schemas through a
 * ZodValidationPipe; react-hook-form uses the same objects as its resolver.
 *
 * §D21 said the identifiers here are English and the displayed text Romanian,
 * and that a second language would cost only the label maps in `enums.ts`.
 * §D44 amends the second half: the maps were never the only Romanian in this
 * package — the validation messages in `book.ts` were too — so displayed text
 * now goes through the catalogs in `messages.ts`, keyed by the `Locale` in
 * `locale.ts`. The identifiers are still English, everywhere, unamended.
 */

export * from "./book.js";
export * from "./budget.js";
export * from "./challenge.js";
export * from "./count.js";
export * from "./cover.js";
export * from "./enums.js";
export * from "./errors.js";
export * from "./i18n.js";
export * from "./locale.js";
export * from "./mcp.js";
export * from "./messages.js";
export * from "./money.js";
export * from "./openlibrary.js";
export * from "./pairing.js";
export * from "./progress.js";
export * from "./settings.js";
export * from "./stats.js";
export * from "./user.js";
