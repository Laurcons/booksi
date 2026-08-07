// `Prisma` is a value here, not just a namespace: `Prisma.Decimal` constructs
// the money columns on the way in.
import { Prisma } from "@prisma/client";

/**
 * The two conversions every money column needs, in one place rather than one
 * copy per module. Sprint 6's budget reads the same `DECIMAL(10,2)` columns
 * Sprint 2 writes, and two private copies of this arithmetic would be two
 * places for a rounding rule to drift.
 */

/**
 * S2.4. `undefined` and `null` pass through unchanged — Prisma reads them as
 * "leave it" and "clear it", the same two meanings a request carries.
 *
 * A number becomes a `Decimal` through its two-decimal string rather than
 * directly: `new Prisma.Decimal(59.9)` starts from the double, and the column
 * is `DECIMAL(10,2)`. Going via `toFixed(2)` puts the rounding here, where the
 * value has already been validated to have no third decimal, instead of
 * leaving it to the driver.
 */
export function toDecimal(
  value: number | null | undefined,
): Prisma.Decimal | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return new Prisma.Decimal(value.toFixed(2));
}

/**
 * The exact arithmetic §D18 asks for happens in SQL; what crosses the wire is
 * only ever displayed, so a number is enough.
 *
 * Raw queries are the reason this takes more than `Decimal`: `SUM()` reaches us
 * through the driver rather than through Prisma's typed client, and arrives as
 * a string on some paths and a `Decimal` on others.
 */
export function toNumber(
  value: Prisma.Decimal | string | number | null,
): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}

/** `SUM` over no rows is NULL; nothing bought cost nothing, not "unknown". */
export function toAmount(
  value: Prisma.Decimal | string | number | null,
): number {
  return toNumber(value) ?? 0;
}

/**
 * Two decimals, for a subtraction the database did not do.
 *
 * `120 - 59.9` is `60.099999999999994` in binary floating point, and S6.3 puts
 * that number on screen. The sums themselves stay in SQL over decimal columns,
 * where they are exact; this rounds only the one step that cannot.
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
