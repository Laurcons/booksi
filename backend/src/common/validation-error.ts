import { BadRequestException } from "@nestjs/common";

/**
 * The one shape a validation failure takes, wherever it is detected.
 *
 * Most of them come out of `ZodValidationPipe`, but not all can: a rule that
 * needs the stored row — "a rating requires a finished book" (S2.3) — is only
 * decidable in the service, after the book has been loaded. A client should
 * not have to parse two error formats depending on which side of that line the
 * rule happened to fall, so both sides build the body here.
 *
 * Keyed by field path, because react-hook-form attaches messages to inputs by
 * path; documented as `ValidationError` in the OpenAPI components.
 */
export function validationFailed(
  errors: Record<string, string[]>,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: "Bad Request",
    message: "Validation failed",
    errors,
  });
}
