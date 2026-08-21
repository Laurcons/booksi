import type { ReactNode } from "react";
import { COVER_MIME_TYPES } from "@bookcsi/shared";
import { CoverPlaceholder } from "./CoverPlaceholder";
import { CREDENTIALED_IMAGE } from "../../lib/media";
import { useT } from "../../i18n/locale-context";

/**
 * The cover, at the size the form can afford to give it, with the file picker
 * folded into it.
 *
 * Both halves of the old arrangement are gone on purpose. There is no section
 * heading, because a picture of a book cover does not need to be labelled
 * "Copertă"; and there is no visible "Încarcă o imagine" control beside it,
 * because the cover *is* the control — clicking it opens the picker, the way
 * every avatar on the web has worked for a decade. The badge in the corner is
 * what makes that discoverable.
 *
 * The input keeps its accessible name (`cover.upload`), moved `sr-only`. That
 * is not a formality: it is what a screen reader announces, and what the
 * covers e2e spec finds the control by.
 */
export function CoverWell({
  title,
  src,
  alt,
  disabled = false,
  onPick,
  children,
}: {
  /** For the placeholder's lettering while there is no image. */
  title: string;
  /** A ready-to-use `src`, or `null` for the drawn placeholder. */
  src: string | null;
  /** How the image announces itself. Defaults to "the cover of {title}". */
  alt?: string;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
  /** Upload state — a line of status or an error, only when there is one. */
  children?: ReactNode;
}) {
  const t = useT();

  return (
    <div className="flex w-24 shrink-0 flex-col gap-2">
      <label className="group relative block cursor-pointer">
        <span className="sr-only">{t("cover.upload")}</span>

        {src === null ? (
          <span className="block h-36 w-24 overflow-hidden rounded-[2px]">
            <CoverPlaceholder title={title} variant="card" />
          </span>
        ) : (
          <img
            {...CREDENTIALED_IMAGE}
            src={src}
            alt={alt ?? t("book.coverOf", { title })}
            className="h-36 w-24 rounded-[2px] object-cover"
          />
        )}

        <input
          type="file"
          accept={COVER_MIME_TYPES.join(",")}
          disabled={disabled}
          onChange={(event) => onPick(event.target.files?.[0])}
          className="sr-only"
        />

        {/* The affordance. Placed over the cover's corner on a dark disc, the
            same treatment the favourite star gets in the gallery so that it
            stays legible whatever the jacket underneath is doing. */}
        <span
          aria-hidden
          title={t("bookForm.changeCover")}
          className="absolute bottom-1.5 right-1.5 grid size-7 place-items-center rounded-full border border-line bg-surface-0/80 text-xs text-ink-2 transition-colors duration-150 group-hover:border-accent-quiet group-hover:text-accent"
        >
          ✎
        </span>
      </label>

      {children}
    </div>
  );
}
