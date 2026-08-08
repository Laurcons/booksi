/**
 * §Formulare (docs/kobo_design.md) — `<input type="date">` is asked for as
 * plain text labelled `AAAA-LL-ZZ`, "plus toleranță la parsare pe server".
 * The backend's `calendarDateSchema` takes that literally: `YYYY-MM-DD` only.
 * The tolerance has to live here, then, on the way from the typed text to the
 * API call — this process is the only "server" between the two that can see
 * the original keystrokes.
 *
 * Whatever this cannot make sense of is passed through unchanged, so the
 * API's own message — not a guess invented here — is what the reader sees.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Day first, the everyday Romanian order — the one format actually worth tolerating. */
const DAY_FIRST = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;

export function normalizeDateInput(raw: string): string | null {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return null;
  }

  if (ISO.test(trimmed)) {
    return trimmed;
  }

  const dayFirst = DAY_FIRST.exec(trimmed);
  if (dayFirst) {
    // Non-null: the pattern has exactly these three capturing groups, so a
    // successful match always populates all three.
    const day = dayFirst[1]!;
    const month = dayFirst[2]!;
    const year = dayFirst[3]!;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return trimmed;
}
