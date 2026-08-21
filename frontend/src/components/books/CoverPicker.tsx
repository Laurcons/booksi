import { useEffect, useState } from "react";
import { CoverWell } from "./CoverWell";
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
  /** The in-progress title, so the placeholder's lettering matches what's typed. */
  title: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const t = useT();
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
    <CoverWell
      title={title}
      src={previewUrl}
      // Not "the cover of X": nothing has been saved yet, and the file may
      // still be replaced before it is.
      alt={t("cover.preview")}
      onPick={(picked) => onChange(picked ?? null)}
    />
  );
}
