import { HttpStatus } from "@nestjs/common";
import type { Request } from "express";
import { AppError } from "../common/app-error";

/**
 * The raw bytes of a request, up to a ceiling.
 *
 * S4.3 uploads one image with one `Content-Type`, so the body is the file —
 * there is nothing for `multipart/form-data` to separate it from. Reading the
 * stream directly keeps a parser and its type definitions out of the
 * dependency list for a route that would use none of it, and leaves the size
 * limit here, in plain sight, instead of inside a middleware's options object.
 *
 * Express only installs a body parser for the content types it is configured
 * with (`application/json`, `application/x-www-form-urlencoded`), so for an
 * `image/*` request the stream reaches the handler untouched.
 *
 * **A rejected request is still read to the end.** Answering the moment the
 * `Content-Length` header looks wrong is the obvious implementation and the
 * wrong one: the client is midway through writing, and a response that closes
 * the connection under it turns our carefully worded 413 into a broken pipe on
 * its side — the user is told "network error" for the one failure we wrote a
 * clear message for. What the early check is really worth is *memory*, not
 * bandwidth; the bytes are already on their way either way. So the stream is
 * drained and discarded, which keeps memory flat at the limit and lets the
 * status actually arrive.
 */
export async function readRawBody(req: Request, limit: number): Promise<Buffer> {
  let rejection = declaredTooLarge(req, limit) ?? wrongContentType(req);

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.byteLength;

    // Past the point of no return: keep pulling bytes off the socket so the
    // client can finish and hear the answer, but stop holding onto them.
    if (rejection !== null) {
      continue;
    }

    // The header was a claim; this is the fact. A client that under-reports
    // its length, or sends a chunked body with none at all, meets the ceiling
    // here instead.
    if (size > limit) {
      rejection = tooLarge(limit);
      chunks.length = 0;
      continue;
    }

    chunks.push(buffer);
  }

  if (rejection !== null) {
    throw rejection;
  }

  return Buffer.concat(chunks);
}

function declaredTooLarge(req: Request, limit: number): AppError | null {
  const declared = Number(req.headers["content-length"]);

  return Number.isFinite(declared) && declared > limit ? tooLarge(limit) : null;
}

function wrongContentType(req: Request): AppError | null {
  const contentType = req.headers["content-type"] ?? "";

  return contentType.startsWith("image/")
    ? null
    : new AppError(
        HttpStatus.BAD_REQUEST,
        "COVER_FORMAT_UNSUPPORTED",
        "Trimite imaginea ca body brut, cu Content-Type image/jpeg, image/png sau image/webp.",
      );
}

function tooLarge(limit: number): AppError {
  const mb = Math.round(limit / (1024 * 1024));

  return new AppError(
    HttpStatus.PAYLOAD_TOO_LARGE,
    "COVER_TOO_LARGE",
    `Imaginea depășește ${mb}MB. Micșoreaz-o și încearcă din nou.`,
  );
}
