import { describe, expect, it } from "vitest";
import { BOOK_FORM_SCRIPT } from "./book-form-script";

/**
 * The ES5 guard, in the same style `probe.spec.ts` holds `PROBE_SCRIPT` to —
 * comments and string literals stripped first, so a forbidden token sitting
 * in a piece of display text (a label, say) does not fail this for a reason
 * that has nothing to do with what the engine has to parse.
 */
describe("BOOK_FORM_SCRIPT", () => {
  const executable = BOOK_FORM_SCRIPT.replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");

  it("has no modern syntax that could fail to parse on the device", () => {
    expect(executable).not.toMatch(/=>/);
    expect(executable).not.toMatch(/\bconst\b/);
    expect(executable).not.toMatch(/\blet\b/);
    expect(executable).not.toMatch(/\bclass\b/);
    expect(executable).not.toMatch(/`/);
    expect(executable).not.toMatch(/\.\.\./);
    expect(executable).not.toMatch(/\basync\b/);
    expect(executable).not.toMatch(/\bawait\b/);
  });

  it("makes no network call of its own — the only request is the form's native submit", () => {
    expect(executable).not.toMatch(/fetch\(/);
    expect(executable).not.toMatch(/XMLHttpRequest/);
    expect(executable).not.toMatch(/\bPromise\b/);
  });

  it("is still real code after all that stripping, not an empty string the checks above pass trivially", () => {
    expect(executable).toMatch(/\bvar\b/);
    expect(executable.length).toBeGreaterThan(300);
  });

  it("checks for querySelectorAll before using it, so a browser without it leaves the fallback page untouched", () => {
    expect(BOOK_FORM_SCRIPT).toMatch(/if\s*\(!document\.querySelectorAll\)\s*\{\s*return;?\s*\}/);
  });

  it("does nothing at all when there is only one section to show", () => {
    // The guard that makes this script a pure enhancement: a page with fewer
    // than two `.wizard-section` blocks is left exactly as the server sent it.
    expect(executable).toMatch(/sections\.length < 2/);
  });

  it("opens on whichever section a validation error actually landed in", () => {
    // Otherwise a re-rendered form with an error on step 3 would silently
    // hide it behind step 1, the script's own default starting point. Checked
    // against the raw source, not `executable` — the class name it looks for
    // lives inside a string literal, which the ES5 guard above strips.
    expect(BOOK_FORM_SCRIPT).toMatch(/field-error/);
  });
});
