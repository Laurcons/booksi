import { z } from "zod";

/**
 * S4.3 — what counts as an acceptable cover image, defined once for both ends.
 *
 * The client resizes before uploading and the server enforces the limits
 * regardless; those are two different jobs reading one set of numbers. A
 * second copy of "5MB" would drift the day one of them changed, and the
 * failure mode is a client that cheerfully uploads something the server then
 * rejects.
 */

/**
 * The upload ceiling. Generous on purpose: the client aims for a couple of
 * hundred KB after resizing, and this is the headroom for the case where the
 * resize could not run at all (a corrupt file, a browser without canvas
 * support) and the original goes up as-is.
 */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

/**
 * What an upload answers with: where the new image lives, version included.
 *
 * Returned rather than left to a refetch because the URL is the only thing
 * about the book that changed, and because the version in it is the whole
 * point — a client that kept showing the old URL would keep showing the old
 * cover, cached for a year, with nothing to suggest the upload had worked.
 */
export const coverRefSchema = z.object({ coverUrl: z.string() });

export type CoverRef = z.infer<typeof coverRefSchema>;

export const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CoverMimeType = (typeof COVER_MIME_TYPES)[number];

/**
 * The format, read off the bytes rather than off `Content-Type`.
 *
 * The header is chosen by the client, so trusting it means storing whatever
 * was sent under whatever label was claimed, and serving it back with that
 * label from our own origin. The first eight bytes are not a security boundary
 * on their own, but they are the difference between "this file is a PNG" and
 * "this request said PNG".
 *
 * Returns `null` for anything that is not one of the three accepted formats,
 * which is also the answer for a file too short to identify.
 */
export function sniffCoverMimeType(bytes: Uint8Array): CoverMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // WebP is a RIFF container: "RIFF", four bytes of length, then "WEBP".
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  );
}
