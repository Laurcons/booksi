import {
  createParamDecorator,
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request } from "express";
import type { z } from "zod";
import {
  type ErrorCode,
  type HttpErrorBody,
  type Locale,
  translateIssue,
  zodErrorMap,
} from "@bookcsi/shared";
import { localeOf } from "./request-locale";

/**
 * Validates a body or a query against a schema from `shared/`, so that the API
 * and the form on the other side enforce the same rules from the same object.
 *
 * Named at the parameter — `@ValidatedBody(createBookSchema)` — rather than
 * registered globally, which is the same choice the `ZodValidationPipe` this
 * replaces made and for the same reason: a global validator would need a
 * second, reflection-based channel to discover which schema belongs to which
 * route, and naming the schema at the parameter is that information, visible.
 *
 * ## Why a parameter decorator and not a pipe (§D44)
 *
 * A pipe cannot see the request. Its `transform(value, metadata)` gets the value
 * and a description of where the value came from, and nothing else — which was
 * sufficient while every message was Romanian and became insufficient the moment
 * the wording depended on who was asking. `createParamDecorator` hands its
 * factory the full `ExecutionContext`, so the locale is simply read off the
 * request that is already there (`localeOf`).
 *
 * The alternatives were both heavier and worse. Threading the locale through an
 * `AsyncLocalStorage` context would put the answer somewhere the reader cannot
 * see it from the call site. Leaving the pipe in place and re-wording the
 * messages later in the exception filter would mean carrying raw `ZodIssue`s
 * through an exception and re-deriving sentences at catch time, when the parse
 * that produced them could simply have been told the language up front.
 *
 * Swagger is unaffected: `@ApiBody`/`@ApiQuery` are declared explicitly against
 * the schema registry in `docs/openapi.ts` (they were never inferred from
 * `@Body`), so the documentation does not know or care which decorator supplies
 * the value.
 */

/**
 * A schema failure. Its own class rather than an `AppError` because it is the
 * one error carrying *several* messages — one per broken rule — where `AppError`
 * names a single failure by key.
 *
 * It arrives at the filter already worded, which is the point of validating
 * inside a parameter decorator: the request was in hand, so the language was
 * known before the parse rather than after the throw.
 */
export class SchemaValidationError extends HttpException {
  readonly code: ErrorCode = "VALIDATION_FAILED";

  constructor(messages: string[]) {
    const body: HttpErrorBody = {
      statusCode: HttpStatus.BAD_REQUEST,
      code: "VALIDATION_FAILED",
      message: messages,
    };

    super(body, HttpStatus.BAD_REQUEST);
  }
}

/**
 * One sentence per issue, each naming its field.
 *
 * An issue on the object itself — an unrecognised key, say — has an empty path
 * and stands on its own, which is why the path is prefixed rather than assumed.
 *
 * The path is *not* translated. It names a field in the API contract, and those
 * are English everywhere by §D21 — `title`, `publicationYear` — so translating
 * the half of this string that is an identifier would be inventing a second
 * vocabulary for the same field.
 */
function messages(error: z.ZodError, locale: Locale): string[] {
  return error.issues.map((issue) => {
    const sentence = translateIssue(locale, issue.message);

    return issue.path.length > 0
      ? `${issue.path.join(".")}: ${sentence}`
      : sentence;
  });
}

/**
 * Parse or throw, in the reader's language.
 *
 * Both halves of the language decision happen here, and they are separate
 * mechanisms: `zodErrorMap` gives zod's *own* messages (the constraints we never
 * labelled) in the right language during the parse, and `translateIssue` turns
 * the keys we *did* attach into sentences afterwards. Neither covers the other's
 * cases.
 */
function parseOrThrow<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  locale: Locale,
): z.output<Schema> {
  const parsed = schema.safeParse(value, { error: zodErrorMap(locale) });

  if (!parsed.success) {
    throw new SchemaValidationError(messages(parsed.error, locale));
  }

  return parsed.data;
}

/**
 * ## The wrapper object is load-bearing — do not unwrap it
 *
 * Nest decides whether an argument to a param decorator is *data* or a *pipe* by
 * duck-typing it (`create-route-param-metadata.decorator.js`):
 *
 *     const isPipe = (pipe) => pipe && (
 *       (isFunction(pipe) && pipe.prototype && isFunction(pipe.prototype.transform))
 *       || isFunction(pipe.transform)
 *     );
 *
 * A zod schema satisfies the second branch, because `.transform()` is how zod
 * spells a mapping step. So passing a schema straight through — the obvious
 * `RawBody(schema)` — makes Nest classify it as a pipe, hand the factory
 * `undefined` as its data, and register the schema as a pipe that Nest will
 * happily call `.transform(value)` on. The failure is not a type error and not
 * an obvious one at runtime either: every route 500s with "Cannot read
 * properties of undefined (reading 'safeParse')", pointing at the validator
 * rather than at the registration that broke it.
 *
 * Wrapping in `{ schema }` is the fix, because a plain object with one key has
 * no `.transform` and so reads as data. The wrapping is done *here*, inside a
 * thin exported function, rather than asked of the 14 call sites — they keep
 * reading `@ValidatedBody(createBookSchema)`.
 */
type SchemaData = { schema: z.ZodType };

const RawValidatedBody = createParamDecorator(
  ({ schema }: SchemaData, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<Request>();

    return parseOrThrow(schema, req.body, localeOf(req));
  },
);

const RawValidatedQuery = createParamDecorator(
  ({ schema }: SchemaData, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<Request>();

    return parseOrThrow(schema, req.query, localeOf(req));
  },
);

const RawValidatedParam = createParamDecorator(
  ({ name, schema }: SchemaData & { name: string }, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<Request>();

    return parseOrThrow(schema, req.params[name], localeOf(req));
  },
);

/** The request body, validated. Replaces `@Body(new ZodValidationPipe(s))`. */
export const ValidatedBody = (schema: z.ZodType): ParameterDecorator =>
  RawValidatedBody({ schema });

/** The query string, validated. Replaces `@Query(new ZodValidationPipe(s))`. */
export const ValidatedQuery = (schema: z.ZodType): ParameterDecorator =>
  RawValidatedQuery({ schema });

/**
 * One route parameter, validated. Replaces
 * `@Param(name, new ZodValidationPipe(s))`.
 *
 * Takes the name as well as the schema, because a path parameter is addressed by
 * name where a body and a query are the whole of their thing.
 */
export const ValidatedParam = (
  name: string,
  schema: z.ZodType,
): ParameterDecorator => RawValidatedParam({ name, schema });
