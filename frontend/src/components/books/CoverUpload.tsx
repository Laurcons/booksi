import { useRef, useState } from "react";
import { COVER_MIME_TYPES, type Book } from "@bookcsi/shared";
import { useUploadCover } from "../../api/openlibrary";
import { apiImageSrc, CREDENTIALED_IMAGE } from "../../lib/media";
import { CoverThumb } from "./CoverThumb";

/**
 * S4.3 — replacing a book's cover with one of your own.
 *
 * Offered while editing rather than while adding, for the plain reason that
 * the route is `PUT /books/{id}/cover` and a book being added has no id yet.
 * The order that falls out — add the book, then give it a cover — is also the
 * order the story describes: the placeholder comes first and this is the way
 * out of it.
 *
 * The image is resized in the browser before it goes (see `resizeCover`), so
 * what leaves is typically a couple of hundred kilobytes rather than whatever
 * a phone camera produced.
 */
export function CoverUpload({ book }: { book: Book }) {
  const upload = useUploadCover(book.id);
  const input = useRef<HTMLInputElement>(null);

  /**
   * The URL the *upload* answered with, preferred over the book's own for as
   * long as this dialog is open.
   *
   * Not belt and braces: `book` was captured when the dialog opened, so its
   * `coverUrl` still carries the old version — and the old version is cached
   * for a year (§D26). Drawing it again would show the previous image and read
   * as an upload that silently did nothing.
   */
  const [uploaded, setUploaded] = useState<string | null>(null);

  const coverUrl = uploaded ?? book.coverUrl;
  const src = apiImageSrc(coverUrl);

  const choose = async (file: File | undefined) => {
    if (file === undefined) {
      return;
    }

    const result = await upload.mutateAsync(file).catch(() => null);

    if (result !== null) {
      setUploaded(result.coverUrl);
    }

    // Cleared so that picking the same file twice — after a failure, say —
    // still fires a change event.
    if (input.current !== null) {
      input.current.value = "";
    }
  };

  return (
    <div className="sm:col-span-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        Copertă
      </h3>

      <div className="mt-4 flex items-start gap-4">
        {src === null ? (
          <CoverThumb title={book.title} />
        ) : (
          <img
            {...CREDENTIALED_IMAGE}
            src={src}
            alt={`Coperta cărții ${book.title}`}
            className="h-24 w-16 shrink-0 rounded-[2px] object-cover"
          />
        )}

        <div className="min-w-0">
          {/* A labelled input rather than a bare one: the native control
              announces itself as "Choose file", which says nothing about what
              file or what for. */}
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">
              Încarcă o imagine
            </span>
            <input
              ref={input}
              type="file"
              accept={COVER_MIME_TYPES.join(",")}
              disabled={upload.isPending}
              onChange={(event) => void choose(event.target.files?.[0])}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border file:border-accent-quiet file:bg-accent-quiet/40 file:px-3 file:py-1.5 file:text-sm file:text-accent hover:file:bg-accent-quiet disabled:opacity-60"
            />
          </label>

          <p className="mt-2 text-xs text-ink-3">
            JPEG, PNG sau WebP. Se micșorează automat înainte de încărcare.
          </p>

          {upload.isPending && (
            <p role="status" className="mt-2 text-xs text-ink-2">
              Se încarcă…
            </p>
          )}

          {upload.isError && (
            <p role="alert" className="mt-2 text-xs text-status-abandoned">
              {upload.error.message}
            </p>
          )}

          {upload.isSuccess && !upload.isPending && (
            <p role="status" className="mt-2 text-xs text-ink-2">
              Coperta a fost înlocuită.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
