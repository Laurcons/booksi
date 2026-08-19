import { useState } from "react";
import { useDebounced } from "./use-debounced";

/**
 * §D42 — the two halves of a search box, kept apart on purpose.
 *
 * What the user is typing (`search`) updates on every keystroke, because an
 * input that lags behind the keyboard is unusable. What the API is asked for
 * (`q`) updates once the typing pauses, because that is a request per pause
 * rather than per letter — the same 300ms the Open Library search and the ISBN
 * duplicate check already settle on.
 *
 * A hook rather than state inside a search component, because the box is not
 * always the thing that clears it: the gallery's "Șterge filtrele" resets the
 * whole query, and a component owning its own text would keep showing a search
 * that is no longer being applied. Whoever owns the query owns the text.
 *
 * `q` is `undefined` — never `""` — when there is nothing to search for, which
 * is the shape `listParams` and `isFiltered` both read.
 */
export function useBookSearch(): {
  search: string;
  setSearch: (search: string) => void;
  q: string | undefined;
} {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300).trim();

  return { search, setSearch, q: debounced === "" ? undefined : debounced };
}
