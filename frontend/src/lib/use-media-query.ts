import { useEffect, useState } from "react";

/**
 * A CSS media query, as a boolean React can branch on.
 *
 * Used where the two layouts have to be *alternatives* rather than one of them
 * hidden with `display: none` — the book list renders as a table on a wide
 * screen and as cards on a narrow one, and shipping both would put every row in
 * the accessibility tree twice, where a screen reader would read the library
 * end to end and then read it again.
 *
 * Defaults to not matching when there is no `matchMedia` at all, which is the
 * case in jsdom. Every query in the app therefore has to be written so that
 * "no match" is the wide, full-feature layout: a test that never opted into a
 * viewport gets the same thing a desktop browser gets.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesNow(query));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const list = window.matchMedia(query);

    // Re-read on subscribe: the viewport can have changed between the initial
    // render and this effect, and a stale `false` would leave a phone showing
    // the desktop layout until the next resize.
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);

    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function matchesNow(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(query).matches;
}
