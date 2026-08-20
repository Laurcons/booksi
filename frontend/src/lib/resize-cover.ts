import { COVER_MAX_BYTES } from "@bookcsi/shared";

/**
 * S4.3 — shrinking a cover before it is uploaded.
 *
 * The point is not the upload succeeding; the server would accept a 4MB phone
 * photo just as happily. It is what §D18 rests on: covers are kept as blobs
 * *inside* the database on the argument that they are tens of kilobytes each,
 * which is what makes a single `mysqldump` a complete backup. Upload a few
 * dozen unresized photographs and that argument quietly stops being true.
 *
 * A courtesy, never a control. Anything here can be skipped by a client that
 * simply POSTs the bytes, so the server enforces the same limits regardless —
 * see `readRawBody` and `CoversService.upload` on the API side.
 */

/** Long edge, in pixels. A cover is displayed at 200px at its largest. */
export const COVER_MAX_EDGE = 1000;

/** Re-encoding quality. 0.85 is where JPEG stops being visibly lossy. */
export const COVER_QUALITY = 0.85;

const JPEG = "image/jpeg";

/**
 * How big the re-encoded image should be.
 *
 * Split out from the drawing because it is the part with a decision in it, and
 * because a canvas is the one thing a jsdom test cannot give you.
 *
 * An image already inside the limit is returned at its own size rather than
 * scaled up — enlarging a small cover would add bytes and no detail.
 */
export function coverTargetSize(
  width: number,
  height: number,
  maxEdge = COVER_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);

  if (longest <= maxEdge || longest === 0) {
    return { width, height };
  }

  const scale = maxEdge / longest;

  // Rounded, and floored at one: a canvas of zero width throws, and an image
  // whose short edge rounds to nothing is degenerate rather than small.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The file to actually upload.
 *
 * Falls back to the original whenever the browser cannot do the work — a
 * corrupt file, an image format it will not decode, a canvas that refuses to
 * export. The fallback is the reason this never throws: S4.3 is a way *out* of
 * having no cover, and refusing the upload because the optimisation failed
 * would be the feature defeating itself.
 *
 * The one thing it will not do is hand back something already over the
 * ceiling. That is a failure the user can act on ("make it smaller"), and it
 * beats a 413 arriving after five megabytes have gone up the wire.
 */
export async function resizeCover(file: File): Promise<Blob> {
  const resized = await tryResize(file);

  if (resized !== null) {
    return resized;
  }

  if (file.size > COVER_MAX_BYTES) {
    // A key, not a sentence (§D44): this runs in a plain module with no reader
    // in scope, and the message surfaces through the mutation's `error.message`
    // — so whoever displays it translates it, the same split `AppError` uses on
    // the server. The size travels with it, since only this function knows it.
    throw new CoverTooLargeError(Math.round(file.size / (1024 * 1024)));
  }

  return file;
}

async function tryResize(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);

    try {
      const { width, height } = coverTargetSize(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (context === null) {
        return null;
      }

      context.drawImage(bitmap, 0, 0, width, height);

      return await toBlob(canvas);
    } finally {
      // Bitmaps hold decoded pixels — several times the file's size — until
      // they are closed or garbage collected. Closing is cheap and explicit.
      bitmap.close();
    }
  } catch {
    return null;
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    // JPEG whatever went in: it is the smallest of the three accepted formats
    // for photographic content, and a cover is photographic. Transparency is
    // not something a book jacket has.
    canvas.toBlob((blob) => resolve(blob), JPEG, COVER_QUALITY);
  });
}

/**
 * "Too big, and shrinking it did not help." Its own class so the size survives
 * as a number rather than being baked into a sentence here — see the throw site.
 */
export class CoverTooLargeError extends Error {
  readonly megabytes: number;

  constructor(megabytes: number) {
    super("cover.tooBigToResize");
    this.name = "CoverTooLargeError";
    this.megabytes = megabytes;
  }
}
