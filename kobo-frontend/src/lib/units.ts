/**
 * §Unități (docs/kobo_design.md). `/probe` measured `devicePixelRatio` 1 on a
 * 1212×1264 viewport, on a panel documented at 300ppi — so one CSS pixel here
 * really is one 300th of an inch, not the scaled-down abstraction it would be
 * on a phone. Every size in the design document is given in points or
 * millimetres for exactly this reason: the day that measurement changes,
 * `PX_PER_INCH` is the one constant to fix, and nothing downstream has to be
 * found and re-derived by hand.
 */
export const PX_PER_INCH = 300;

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
