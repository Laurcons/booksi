import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrorCode } from "@bookcsi/shared";

/**
 * An error the user can do something about (§D27).
 *
 * Throwing one is a claim with two parts: that the `message` is written for a
 * person and may be shown to them unaltered, and that the `code` is stable
 * enough for a client to branch on. Anything that cannot honestly make both
 * claims should be a plain `Error` instead — the filter turns those into a
 * bare 500, which is the correct answer for a failure nobody outside this
 * process can act on.
 *
 * Extends `HttpException` rather than replacing it so that Nest's own
 * machinery — route-scoped filters, the throttler, `@ApiResponse` — keeps
 * working unchanged.
 */
export class AppError extends HttpException {
  readonly code: ErrorCode;

  constructor(status: HttpStatus, code: ErrorCode, message: string | string[]) {
    // The body is spelled out here rather than assembled in the filter, so
    // that an `AppError` serialises correctly even on a route whose own filter
    // bypasses the global one.
    super({ statusCode: status, code, message }, status);
    this.code = code;
  }

  /**
   * S0.3 — absent and "someone else's" are the same answer, always. A 403
   * would confirm that a guessed id exists in another library, which is
   * exactly the fact being withheld.
   */
  static notFound(message = "Nu există."): AppError {
    return new AppError(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
  }

  /** A schema failure, or a cross-field rule that needed the stored row. */
  static validation(message: string | string[]): AppError {
    return new AppError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
  }

  static unauthenticated(
    message = "Sesiunea a expirat. Autentifică-te din nou.",
  ): AppError {
    return new AppError(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", message);
  }

  /**
   * Sprint 4 — Open Library did not answer, or answered with something
   * unusable. Actionable despite being a 5xx: the manual form is right there,
   * which is the degradation criterion in one sentence.
   */
  static openLibraryUnavailable(status: HttpStatus, message: string): AppError {
    return new AppError(status, "OPEN_LIBRARY_UNAVAILABLE", message);
  }

  /**
   * A pairing code or id that will not resolve — wrong, expired, or already
   * spent (docs/kobo_design.md §Autentificare). `400`, not `404`: unlike a
   * book id this is never "someone else's", so there is no ownership fact to
   * hide behind a uniform not-found.
   */
  static pairingInvalid(message: string): AppError {
    return new AppError(HttpStatus.BAD_REQUEST, "PAIRING_INVALID", message);
  }
}
