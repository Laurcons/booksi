import { useEffect, useRef, useState } from "react";
import { COVER_MIME_TYPES } from "@bookcsi/shared";
import { CoverThumb } from "./CoverThumb";
import { useT } from "../../i18n/locale-context";

/**
 * The upload half of adding a book — picking and previewing a file only.
 *
 * `CoverUpload` cannot run here: its route is `PUT /books/{id}/cover`, and a
 * book being added has no id yet. `BookFormDialog` holds onto the file this
 * hands back and uploads it itself once the create request has answered.
 */
export function CoverPicker({
  title,
  file,
  onChange,
}: {
  /** The in-progress title, so the placeholder's initial matches what's typed. */
  title: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="sm:col-span-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        {t("book.cover")}
      </h3>

      <div className="mt-4 flex items-start gap-4">
        {previewUrl === null ? (
          <CoverThumb title={title} />
        ) : (
          <img
            src={previewUrl}
            alt={t("cover.preview")}
            className="h-24 w-16 shrink-0 rounded-[2px] object-cover"
          />
        )}

        <div className="min-w-0">
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">
              {t("cover.upload")}
            </span>
            <input
              ref={input}
              type="file"
              accept={COVER_MIME_TYPES.join(",")}
              onChange={(event) => onChange(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border file:border-accent-quiet file:bg-accent-quiet/40 file:px-3 file:py-1.5 file:text-sm file:text-accent hover:file:bg-accent-quiet"
            />
          </label>

          <p className="mt-2 text-xs text-ink-3">
            {t("cover.formatHintPick")}
          </p>
        </div>
      </div>
    </div>
  );
}
