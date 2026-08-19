import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * §D43 — the two constants the scan test and the global setup have to agree on.
 *
 * Their own file because they are needed on both sides of a boundary that cannot
 * import across itself: `global-setup.ts` writes the video before any browser
 * exists, and the spec passes its path as a launch argument. A constant defined
 * in either one would have to be imported by the other, and the setup file is
 * not a module the test config loads for its exports.
 */

/**
 * Dune's ISBN-13, and it is not arbitrary: `9780441013593` is the same edition
 * `BookFormDialog.sprint4.test.tsx` already uses for the typed lookup, so the
 * scanned path and the typed path are demonstrably about one book.
 */
export const SCAN_ISBN = "9780441013593";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Under `test-results/`, which is gitignored — the video is a build artefact. */
export const SCAN_VIDEO = path.join(HERE, "..", "test-results", "ean13-scan.y4m");
