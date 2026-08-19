import { HttpException, HttpStatus } from "@nestjs/common";
import {
  DEFAULT_LOCALE,
  type ErrorCode,
  type ErrorKey,
  type Locale,
  type Vars,
  errorMessageFor,
} from "@bookcsi/shared";

/**
 * An error the user can do something about (§D27).
 *
 * Throwing one is a claim with two parts: that the `key` names a sentence
 * written for a person and may be shown to them unaltered, and that the `code`
 * is stable enough for a client to branch on. Anything that cannot honestly
 * make both claims should be a plain `Error` instead — the filter turns those
 * into a bare 500, which is the correct answer for a failure nobody outside
 * this process can act on.
 *
 * Extends `HttpException` rather than replacing it so that Nest's own
 * machinery — route-scoped filters, the throttler, `@ApiResponse` — keeps
 * working unchanged.
 *
 * ## Why a key and not a sentence (§D44)
 *
 * These are thrown from services, which have no reader: a service knows *what*
 * failed and nothing about who is about to read it. Wording is therefore not
 * its decision to make, and pushing a locale down to every throw site would
 * mean threading the request through `BooksService` to say "not yours" in the
 * right language. So a throw names the failure and `AppExceptionFilter` — which
 * holds the request, and with it the reader — does the wording.
 *
 * The body is still assembled here, in `DEFAULT_LOCALE`, and that is not a
 * leftover. The original reason for building it in the constructor was that an
 * `AppError` has to serialise correctly on a route whose own filter bypasses
 * the global one — `OAuthFailureFilter` and `McpAuthErrorFilter` both exist —
 * and that reason survives §D44 intact. A bypassed error therefore degrades to
 * one language rather than to a bare key on someone's screen.
 */
export class AppError extends HttpException {
  readonly code: ErrorCode;

  /**
   * Kept on the instance so the filter can re-word the response for whoever is
   * actually reading it, rather than parsing the sentence back out of the body.
   */
  readonly key: ErrorKey;

  /**
   * The field this failure is about, when it is about one.
   *
   * Only `validation` sets it, and only for a rule that could not live in the
   * schema because it needed the stored row to decide. The client attaches
   * messages to inputs by reading the `field: sentence` prefix, so a cross-field
   * rule has to produce that same shape or it lands nowhere — and the *sentence*
   * half is chosen by the filter, which is why the field cannot simply be
   * baked into the text here.
   */
  readonly field: string | undefined;

  /**
   * Values the message interpolates — the cover-size limit, which comes from
   * configuration and so cannot be written into either catalog.
   */
  readonly vars: Vars | undefined;

  /**
   * The same body in a different language — what the filter sends once it knows
   * who is reading.
   *
   * Shares `wording` with the constructor so the two cannot drift in *shape*.
   * That mattered once already: the field prefix lived only in the filter for a
   * while, so a bypassed error came out as a bare string where the client was
   * looking for `["rating: …"]` and attached the message to nothing.
   */
  messageFor(locale: Locale): string | string[] {
    return wording(locale, this.key, { field: this.field, vars: this.vars });
  }

  constructor(
    status: HttpStatus,
    code: ErrorCode,
    key: ErrorKey,
    options: { field?: string; vars?: Vars } = {},
  ) {
    super(
      {
        statusCode: status,
        code,
        message: wording(DEFAULT_LOCALE, key, options),
      },
      status,
    );
    this.code = code;
    this.key = key;
    this.field = options.field;
    this.vars = options.vars;
  }

  /**
   * S0.3 — absent and "someone else's" are the same answer, always. A 403
   * would confirm that a guessed id exists in another library, which is
   * exactly the fact being withheld.
   */
  static notFound(key: ErrorKey = "error.notFound"): AppError {
    return new AppError(HttpStatus.NOT_FOUND, "NOT_FOUND", key);
  }

  /**
   * A cross-field rule that needed the stored row.
   *
   * Schema failures no longer come through here: they carry one message per
   * broken rule and are assembled by `parseOrThrow`, which owns that shape.
   */
  static validation(key: ErrorKey, field?: string): AppError {
    return new AppError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", key, {
      field,
    });
  }

  static unauthenticated(key: ErrorKey = "error.unauthenticated"): AppError {
    return new AppError(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", key);
  }

  /** A real session, but the account behind it isn't admin (§D38). */
  static forbidden(key: ErrorKey = "error.forbidden"): AppError {
    return new AppError(HttpStatus.FORBIDDEN, "FORBIDDEN", key);
  }

  /**
   * Sprint 4 — Open Library did not answer, or answered with something
   * unusable. Actionable despite being a 5xx: the manual form is right there,
   * which is the degradation criterion in one sentence.
   */
  static openLibraryUnavailable(status: HttpStatus, key: ErrorKey): AppError {
    return new AppError(status, "OPEN_LIBRARY_UNAVAILABLE", key);
  }

  /**
   * A pairing code or id that will not resolve — wrong, expired, or already
   * spent (docs/kobo_design.md §Autentificare). `400`, not `404`: unlike a
   * book id this is never "someone else's", so there is no ownership fact to
   * hide behind a uniform not-found.
   */
  static pairingInvalid(key: ErrorKey = "error.pairing.invalid"): AppError {
    return new AppError(HttpStatus.BAD_REQUEST, "PAIRING_INVALID", key);
  }
}

/**
 * One key, one language, one `message` — in whichever of its two shapes applies.
 *
 * A field-scoped failure produces the shape a schema failure has: a one-entry
 * array, prefixed with the path. To the client it *is* the same kind of error —
 * `apiFetch` reads the prefix to decide which input to hang the sentence under —
 * so a cross-field rule that answered with a bare string would be a message
 * nothing displays.
 */
function wording(
  locale: Locale,
  key: ErrorKey,
  { field, vars }: { field?: string; vars?: Vars },
): string | string[] {
  const text = errorMessageFor(locale, key, vars);

  return field === undefined ? text : [`${field}: ${text}`];
}
