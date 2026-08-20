import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import type { Book } from "@bookcsi/shared";
import { isMessageKey, type MessageKey } from "../i18n/catalog";

/**
 * §D41 — how the book profile knows where its "înapoi" goes.
 *
 * A book opens from five different screens (the library table, the wishlist,
 * the gallery, the shelf, a challenge) and from none of them at all — a link
 * pasted into a chat, a bookmark, an F5 on the profile itself. One back button
 * has to serve all of that.
 *
 * **`navigate(-1)` is the wrong instrument**, which is worth stating because it
 * is the obvious one. It walks the browser's history rather than the app's
 * structure, so the two cases that have no history entry to walk — the cold
 * link and the reload after arriving by one — send the user out of bookcsi
 * entirely, into whatever they were looking at before. It also cannot label
 * itself: a button that does not know where it goes can only draw an arrow.
 *
 * So the origin travels *with* the navigation, in the history entry's state.
 * That survives a reload (the browser persists `history.state`) and it carries
 * the screen's own name, which is what turns "←" into "← Înapoi la raft".
 *
 * **The name travels as a catalog key, not as a word** (§D44). Because the state
 * outlives the navigation that wrote it, a stored Romanian noun would still be
 * Romanian after the reader switched to English — a label frozen at whichever
 * language happened to be on screen when they clicked. A key is resolved at
 * render, so it follows the language like everything else.
 * When there is no state — the genuinely cold arrival — `defaultOrigin` picks
 * the screen the book itself belongs on rather than guessing.
 */
export interface BookOrigin {
  /** An in-app path: pathname plus whatever query string it carried. */
  to: string;
  /** The screen's name, as a catalog key — see the note above on why. */
  label: MessageKey;
}

export function bookProfilePath(id: string): string {
  return `/books/${id}`;
}

/**
 * The callback a listing screen hands to its rows, cards or spines.
 *
 * Takes the label rather than reading it from the path, because a route is not
 * a name: `/` is "biblioteca" and `/challenge` is "provocare", and a lookup
 * table mapping one to the other would be a second place to keep the nav's
 * wording in step.
 */
export function useOpenBook(label: MessageKey): (book: Book) => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  return useCallback(
    (book: Book) => {
      const origin: BookOrigin = { to: `${pathname}${search}`, label };

      void navigate(bookProfilePath(book.id), { state: { origin } });
    },
    [navigate, pathname, search, label],
  );
}

/**
 * Where the profile's back button points, and what it says.
 *
 * The book is passed in so that a cold arrival still lands somewhere true: a
 * wishlist entry belongs on the wishlist, everything else on the library. It
 * is `undefined` while the book loads, and the button reads "the library" for
 * that moment — the honest default, and the one screen every book appears on.
 */
export function useBookOrigin(book: Book | undefined): BookOrigin {
  const { state } = useLocation();

  return readOrigin(state) ?? defaultOrigin(book);
}

export function defaultOrigin(book: Book | undefined): BookOrigin {
  return book?.status === "WISHLIST"
    ? { to: "/wishlist", label: "origin.wishlist" }
    : { to: "/", label: "origin.library" };
}

/**
 * History state is not ours by the time it comes back — it survives reloads,
 * it is editable from the console, and a stale entry can outlive the shape
 * that wrote it. So it is parsed rather than cast, and the path is held to the
 * same rule `return-to.ts` applies: in-app only, since an absolute URL behind
 * a button labelled "înapoi" is an open redirect wearing a friendly word.
 */
export function readOrigin(state: unknown): BookOrigin | null {
  if (typeof state !== "object" || state === null || !("origin" in state)) {
    return null;
  }

  const origin = (state as { origin: unknown }).origin;

  if (typeof origin !== "object" || origin === null) {
    return null;
  }

  const { to, label } = origin as { to?: unknown; label?: unknown };

  // The label is held to the catalog, not merely to "a non-empty string": state
  // this old can predate a key being renamed, and a bare key on the button is
  // exactly the failure §D44's typed catalog exists to prevent. An unknown one
  // falls back to `defaultOrigin` rather than rendering itself.
  if (typeof to !== "string" || !isMessageKey(label)) {
    return null;
  }

  return to.startsWith("/") && !to.startsWith("//") ? { to, label } : null;
}
