/**
 * §Unități (docs/kobo_design.md). `/probe` measured `devicePixelRatio` 1 on a
 * 1212×1264 viewport, on a panel documented at 300ppi, which is where the
 * first value here — 300 — came from. It was too large by roughly half on
 * the actual device: the first real page built against it read as
 * oversized. `/probe`'s numbers were not wrong, but treating a documented
 * panel spec as equal to what the browser's box model actually uses was —
 * evidently something between the two (a compositor scale, the Kaleido
 * colour layer, or a browser default this old engine doesn't expose to
 * script) halves the effective size. This constant is the correction, found
 * empirically rather than derived, and is exactly why every size in the
 * design document is written in points or millimetres rather than pixels:
 * the day this number moves again, it is the one constant to fix, and
 * nothing downstream has to be found and re-derived by hand.
 */
export const PX_PER_INCH = 150;

export const PX_PER_PT = PX_PER_INCH / 72;
export const PX_PER_MM = PX_PER_INCH / 25.4;

/**
 * The factor between this panel and the 96ppi a "1px" or "2px" in
 * `DESIGN.md` was written against. Anything borrowed from there in pixels —
 * a border, a radius — has to go through this, not through `pt`/`mm`, which
 * assume a typographic or physical origin the borrowed value never had.
 */
const PX_PER_WEB_PX = PX_PER_INCH / 96;

/** Typographic points to CSS pixels on this panel, rounded to a whole pixel. */
export function pt(points: number): number {
  return Math.round(points * PX_PER_PT);
}

/** Millimetres to CSS pixels on this panel, rounded to a whole pixel. */
export function mm(millimeters: number): number {
  return Math.round(millimeters * PX_PER_MM);
}

/** A pixel value written for an ordinary 96ppi screen, rescaled onto this one. */
export function webPx(pixels: number): number {
  return Math.round(pixels * PX_PER_WEB_PX);
}
