import { useEffect, useState } from "react";

/**
 * Holds a value still until the user stops typing. Used by the ISBN duplicate
 * check (S1.1) and, from Sprint 4 on, by the Open Library search that S4.1
 * requires to be debounced at 300ms — one request per pause, not per keystroke.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
