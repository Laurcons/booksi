import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";
import { translateIssue, zodErrorMap } from "@bookcsi/shared";
import type { Locale } from "@bookcsi/shared";
import { useLocale } from "./locale-context";

/**
 * `zodResolver`, with the messages in the reader's language (§D44).
 *
 * The schemas in `shared/` carry **keys** rather than sentences, because a schema
 * is built once at module load and cannot hold text chosen per reader. The
 * server turns those back into words in `ValidatedBody`; this is the other end
 * of the same job, and it is not optional: the form validates in the browser
 * before any request is made, so without this the user sees
 * `validation.title.required` under the field.
 *
 * Two mechanisms, same as on the server, because neither covers the other's
 * cases:
 *
 * - `zodErrorMap(locale)` is handed to the parse, which is what localises the
 *   messages **zod** generates for the constraints we never labelled (`.max(255)`).
 * - `translateIssue` maps the keys **we** attached. A catalog miss returns its
 *   input, so zod's already-localised sentences pass through untouched.
 */
export function useLocalizedResolver<
  TFieldValues extends FieldValues,
  TContext,
  TTransformed,
>(
  schema: z.ZodType<TTransformed, TFieldValues>,
): Resolver<TFieldValues, TContext, TTransformed> {
  const { locale } = useLocale();

  return useMemo(() => {
    // `zodResolver` is overloaded across zod 3 and zod 4 shapes and cannot pick
    // an arm from a generic `ZodType`; the schema is a real zod 4 object, which
    // is the arm the second argument (`{ error }`) belongs to.
    const base = zodResolver(
      schema as Parameters<typeof zodResolver>[0],
      { error: zodErrorMap(locale) },
    ) as Resolver<TFieldValues, TContext, TTransformed>;

    return async (values, context, options) => {
      const result = await base(values, context, options);

      // `ResolverResult` is a union discriminated by whether `errors` is empty,
      // and rewriting the messages inside it is a change the compiler cannot see
      // through: to it, the spread widens `errors` and both arms of the union
      // stop matching. The transformation preserves every key and every type —
      // only the strings behind `message` change — so the cast asserts something
      // true that is merely not provable here.
      return { ...result, errors: localiseErrors(result.errors, locale) } as Awaited<
        ReturnType<Resolver<TFieldValues, TContext, TTransformed>>
      >;
    };
  }, [schema, locale]);
}

/**
 * Walk react-hook-form's error tree and translate each `message`.
 *
 * Recursive because the tree is: a field error is `{ type, message, ref }`, and
 * a nested object's errors are a branch of the same shape. Only `message` is
 * touched — `ref` is a live DOM node and `type` is what a caller branches on.
 */
function localiseErrors<E extends object>(errors: E, locale: Locale): E {
  const out: Record<string, unknown> = {};

  for (const [field, error] of Object.entries(errors)) {
    if (error === undefined || error === null) {
      continue;
    }

    if (typeof error === "object" && "message" in error && typeof error.message === "string") {
      out[field] = { ...error, message: translateIssue(locale, error.message) };
      continue;
    }

    out[field] =
      typeof error === "object" ? localiseErrors(error, locale) : error;
  }

  return out as E;
}
