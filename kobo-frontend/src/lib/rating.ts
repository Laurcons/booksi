/**
 * §P8 (docs/kobo_design.md) — whether the device's font has `★`/`☆` was never
 * answered by `/probe`: the visual questions there never asked about it. This
 * book list is the first real page to reach the device, so it is also the
 * first real test — render the glyphs, and if they come back as tofu on the
 * Kobo, flip this one flag to `false` and the whole surface falls back to
 * digits at once.
 */
export const STAR_GLYPHS_ENABLED = true;

const FULL_STAR = "★";
const EMPTY_STAR = "☆";
const STAR_COUNT = 5;

/** `null` reads as "no rating yet", not as zero stars. */
export function ratingLabel(rating: number | null): string {
  if (rating === null) {
    return "—";
  }

  if (!STAR_GLYPHS_ENABLED) {
    return `${rating}/${STAR_COUNT}`;
  }

  return FULL_STAR.repeat(rating) + EMPTY_STAR.repeat(STAR_COUNT - rating);
}
