import { useState } from "react";
import type { Book } from "@bookcsi/shared";
import { useUploadCover } from "../../api/openlibrary";
import { apiImageSrc } from "../../lib/media";
import { CoverWell } from "./CoverWell";
import { useT } from "../../i18n/locale-context";
import { CoverTooLargeError } from "../../lib/resize-cover";

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
 *
 * The visible half moved into `CoverWell` at the tabbed-form redesign: the
 * cover became the button. What stayed here is everything that is not layout —
 * the upload, and the three things that can come back from it.
 */
export function CoverUpload({ book }: { book: Book }) {
  const t = useT();
  const upload = useUploadCover(book.id);

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

  const src = apiImageSrc(uploaded ?? book.coverUrl);

  const choose = async (file: File | undefined) => {
    if (file === undefined) {
      return;
    }

    const result = await upload.mutateAsync(file).catch(() => null);

    if (result !== null) {
      setUploaded(result.coverUrl);
    }
  };

  return (
    <CoverWell
      title={book.title}
      src={src}
      disabled={upload.isPending}
      onPick={(file) => void choose(file)}
    >
      {/* Only ever one of these, and only while it is true. A cover that
          uploaded fine says so for a moment and then gets out of the way. */}
      {upload.isPending && (
        <p role="status" className="text-xs text-ink-3">
          {t("cover.uploading")}
        </p>
      )}

      {upload.isError && (
        <p role="alert" className="text-xs text-error">
          {/* `CoverTooLargeError` is thrown client-side and carries a key
              plus the size; anything else already arrived worded (§D27). */}
          {upload.error instanceof CoverTooLargeError
            ? t("cover.tooBigToResize", { mb: upload.error.megabytes })
            : upload.error.message}
        </p>
      )}

      {upload.isSuccess && !upload.isPending && (
        <p role="status" className="text-xs text-ink-3">
          {t("cover.replaced")}
        </p>
      )}
    </CoverWell>
  );
}
