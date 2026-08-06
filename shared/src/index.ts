/**
 * Contracts shared by the API and the web client, so that a DTO is defined
 * once instead of twice. Nest validates with these schemas through a
 * ZodValidationPipe; react-hook-form uses the same objects as its resolver.
 *
 * Everything here is in English (§D21). Romanian belongs to the label maps at
 * the bottom of `enums.ts`, which are the only place a second language would
 * ever have to be duplicated.
 */

export * from "./book.js";
export * from "./enums.js";
export * from "./user.js";
