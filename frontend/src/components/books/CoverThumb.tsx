/**
 * S1.2 asks for a cover column from the start, but covers only arrive in
 * Sprint 4 — so every row shows the placeholder for now.
 *
 * docs/DESIGN.md §Placeholderul: not a generic "missing image" icon but a
 * drawn cover — surface-3, a thin brass inner rule, serif lettering. At 32×48
 * the title does not fit, so the initial stands in for it; the point is that a
 * table full of these reads as a shelf of unjacketed books rather than as a
 * column of broken images.
 */
export function CoverThumb({ title }: { title: string }) {
  const initial = title.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      aria-hidden
      className="grid h-12 w-8 shrink-0 place-items-center rounded-[2px] bg-surface-3 p-[3px]"
    >
      <span className="grid size-full place-items-center rounded-[1px] border border-accent/30 font-display text-sm text-ink-2">
        {initial}
      </span>
    </span>
  );
}
