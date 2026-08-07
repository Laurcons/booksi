import { useState } from "react";
import type { OpenLibraryResult } from "@bookcsi/shared";
import { MIN_SEARCH_LENGTH, useOpenLibrarySearch } from "../../api/openlibrary";
import { errorMessage } from "../../lib/api";
import { apiImageSrc, CREDENTIALED_IMAGE } from "../../lib/media";
import { useDebounced } from "../../lib/use-debounced";

/** Only for a failure with no words of its own — see `errorMessage` (§D27). */
const SEARCH_FAILED =
  "Open Library nu răspunde acum. Completează cartea manual mai jos.";

/**
 * S4.1 — the search band at the top of the add dialog.
 *
 * **Beside the manual form, never in place of it.** S1.1 says the manual form
 * stays permanently available, so this is a band above the fields rather than
 * a step in front of them or a screen of its own: picking a result fills the
 * inputs below, which stay exactly as editable as they were (S1.3). Someone
 * who does not want to search can ignore the band entirely and type, which is
 * the flow Sprint 1 shipped and Sprint 4 is not allowed to take away.
 *
 * The results are *works*, not editions (§D7) — the thing a reader recognises.
 * Which edition that means is the server's problem, resolved on selection.
 */
export function OpenLibrarySearch({
  onSelect,
  busy = false,
}: {
  onSelect: (result: OpenLibraryResult) => void;
  /** Set while the parent is resolving the edition behind a chosen result. */
  busy?: boolean;
}) {
  const [query, setQuery] = useState("");

  // The 300ms S4.1 asks for: one request per pause in typing, not per key.
  const debounced = useDebounced(query, 300);
  const search = useOpenLibrarySearch(debounced);

  // The dropdown closes on selection, but the text stays: it is what the user
  // searched for, and clearing it would look like the search had failed.
  const [dismissed, setDismissed] = useState(false);

  const typing = query.trim() !== debounced.trim();
  const open = !dismissed && debounced.trim().length >= MIN_SEARCH_LENGTH;

  const choose = (result: OpenLibraryResult) => {
    setDismissed(true);
    onSelect(result);
  };

  return (
    <div className="border-b border-line bg-surface-2/40 px-6 py-4">
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm text-ink-2">Caută în Open Library</span>
          <span className="text-xs text-ink-3">după titlu sau autor</span>
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDismissed(false);
          }}
          placeholder="Dune, Frank Herbert…"
          autoComplete="off"
          className="w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent"
        />
      </label>

      <p className="mt-2 text-xs text-ink-3">
        Sau completează manual mai jos — câmpurile rămân editabile oricum.
      </p>

      {open && (
        <div className="mt-3">
          {/* A pending fetch and a pause not yet elapsed look the same to
              someone waiting, so they read the same. */}
          {(search.isPending || typing) && (
            <p className="text-sm text-ink-3">Se caută…</p>
          )}

          {/* The degradation criterion, on screen.

              The API's own sentence, whatever its status: a failed search is a
              502 or a 503, and §D27's code is what lets those through instead
              of being flattened into a generic apology. The fallback covers
              the case with nothing to say — a network error that never reached
              the API at all. */}
          {search.isError && (
            <p role="status" className="text-sm text-ink-2">
              {errorMessage(search.error, SEARCH_FAILED)}
            </p>
          )}

          {search.isSuccess && search.data.length === 0 && (
            <p className="text-sm text-ink-2">
              Niciun rezultat. Completează manual mai jos.
            </p>
          )}

          {search.isSuccess && search.data.length > 0 && (
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface-1">
              {search.data.map((result) => (
                <li key={`${result.workKey}-${result.editionKey ?? "none"}`}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => choose(result)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-3 disabled:opacity-60"
                  >
                    <ResultThumb result={result} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">
                        {result.title}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {[result.author, result.firstPublishYear]
                          .filter((part) => part !== null)
                          .join(" · ") || "autor necunoscut"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The small cover beside a result.
 *
 * `thumbnailUrl` is a path on our own API — the proxy exists so that this
 * `<img>` is not a request to `covers.openlibrary.org` made by the browser.
 * Editions without a cover fall back to the same drawn placeholder the table
 * uses, rather than to a broken image.
 */
function ResultThumb({ result }: { result: OpenLibraryResult }) {
  const src = apiImageSrc(result.thumbnailUrl);

  if (src === null) {
    return <span aria-hidden className="h-12 w-8 shrink-0 rounded-[2px] bg-surface-3" />;
  }

  return (
    <img
      {...CREDENTIALED_IMAGE}
      src={src}
      alt=""
      loading="lazy"
      className="h-12 w-8 shrink-0 rounded-[2px] object-cover"
    />
  );
}
