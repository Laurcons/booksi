import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router";
import type { AuthUser } from "@bookcsi/shared";
import { useCurrentUser, useLogout } from "../api/auth";
import { focusable, trapTab } from "../lib/focus-trap";

/**
 * The whole product's shape. Every entry is a real destination as of Sprint 8;
 * until then the unbuilt ones were greyed rather than hidden, which is how the
 * nav read from Sprint 1 and how §D28 settled where each screen would live.
 *
 * The third entry said "Tracker" for eight sprints and no story ever delivered
 * anything by that name — USER_STORIES.md uses the word for the app as a whole.
 * §D32 gave the slot to the one screen that had nowhere to go: S8.2's shelf.
 * The dashboard is not in this list on purpose; S8.1 puts it at the top of
 * "Bibliotecă", because a dashboard you have to navigate to is not one you see
 * on opening the app.
 */
const NAV: { label: string; to?: string }[] = [
  { label: "Bibliotecă", to: "/" },
  { label: "Galerie", to: "/gallery" },
  { label: "Raft", to: "/shelf" },
  { label: "Wishlist", to: "/wishlist" },
  { label: "Buget", to: "/budget" },
  { label: "Statistici", to: "/stats" },
  // A curated set of books against a deadline — backend/src/challenges/.
  { label: "Provocare", to: "/challenge" },
];

const NAV_ITEM =
  "relative rounded-lg px-3 py-2 text-sm transition-colors duration-150 ";

export function Header({ onAddBook }: { onAddBook?: () => void }) {
  const { data: user } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-0/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6 md:gap-8">
        {/* Below `md` the nav below is hidden, and for eight sprints nothing
            took its place — five of the six destinations were unreachable on a
            phone. This is that missing door. */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Meniu"
          aria-expanded={menuOpen}
          className="-ml-2 grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink md:hidden"
        >
          <MenuIcon />
        </button>

        {/* A `NavLink`, not an `<a>`: now that there is more than one screen,
            an anchor here would reload the whole document. */}
        <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
          <BookMark />
          <span className="font-display text-xl tracking-tight text-ink">
            Bookcsi
          </span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) =>
            item.to === undefined ? (
              // Not a link and not a button: there is nowhere to go yet, and a
              // dead `href="#"` would jump the page to the top on click.
              <span
                key={item.label}
                aria-disabled
                className={NAV_ITEM + "text-ink-3/60"}
              >
                {item.label}
              </span>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                // `end` so "Bibliotecă" (path "/") does not also light up on
                // /wishlist, which every route is nested under.
                end
                className={({ isActive }) =>
                  NAV_ITEM +
                  (isActive
                    ? "text-ink"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink-2")
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute inset-x-3 -bottom-px h-px bg-accent" />
                    )}
                  </>
                )}
              </NavLink>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {/* S1.1 — the manual form is reachable from every screen, and stays
              so after Sprint 4 adds Open Library beside it.

              Narrow screens get the `+` alone: the full label ate about forty
              percent of a 390px bar, and the header has exactly one primary
              verb, so one glyph says it. The words stay in the accessible name
              at every width rather than being dropped with the pixels. */}
          {onAddBook && (
            <button
              type="button"
              onClick={onAddBook}
              aria-label="Adaugă o carte"
              title="Adaugă o carte"
              className="flex size-9 items-center justify-center gap-1.5 rounded-lg border border-accent-quiet bg-accent-quiet/40 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet sm:size-auto sm:px-3.5 sm:py-2"
            >
              <PlusIcon />
              <span className="max-sm:sr-only">Adaugă o carte</span>
            </button>
          )}
          {user && <AccountMenu user={user} />}
        </div>
      </div>

      {menuOpen && <NavDrawer onClose={() => setMenuOpen(false)} />}
    </header>
  );
}

/**
 * The nav, on a screen too narrow to lay it out in a row.
 *
 * A drawer rather than a bottom tab bar or a scrolling strip of pills: six
 * destinations is one more than a bottom bar holds comfortably, and a nav you
 * have to swipe sideways is a nav whose last two entries nobody finds. It also
 * leaves room for a seventh screen without a redesign.
 *
 * Same overlay obligations as `Modal`, and for the same reasons — Escape, a
 * backdrop that closes, a trapped Tab, a locked page behind, and focus handed
 * back to the hamburger on the way out. Portalled for the reason `Modal`
 * documents: the header is `sticky` with a `backdrop-blur`, and a filtered
 * ancestor would quietly become the containing block for anything `fixed`
 * inside it.
 */
function NavDrawer({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Navigating is the drawer's whole purpose, so arriving somewhere closes it.
  // Keyed on the path rather than wired into each link's `onClick`, which would
  // miss the browser's own back button.
  //
  // `openedAt` is what keeps this from closing the drawer on the same tick it
  // opened: the effect runs once on mount, and without a path to compare
  // against, that first run would fire `onClose` before anything was clicked.
  const openedAt = useRef(pathname);

  useEffect(() => {
    if (pathname !== openedAt.current) {
      onClose();
    }
  }, [pathname, onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "Tab") {
        trapTab(event, panelRef.current);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    focusable(panelRef.current)[0]?.focus();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-black/60 md:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Meniu"
        className="flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface-2 shadow-lg shadow-black/50"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <span className="font-display text-xl tracking-tight text-ink">
            Bookcsi
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide meniul"
            className="-mr-2 grid size-9 place-items-center rounded-lg text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto p-3">
          {NAV.map((item) =>
            item.to === undefined ? (
              <span
                key={item.label}
                aria-disabled
                className="rounded-lg px-3 py-2.5 text-ink-3/60"
              >
                {item.label}
              </span>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                end
                className={({ isActive }) =>
                  "rounded-lg px-3 py-2.5 transition-colors duration-150 " +
                  (isActive
                    ? "bg-accent-quiet/40 text-accent"
                    : "text-ink-2 hover:bg-surface-3 hover:text-ink")
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </div>
    </div>,
    document.body,
  );
}

function AccountMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const logout = useLogout();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.email}
        className="block rounded-full transition-opacity duration-150 hover:opacity-85"
      >
        <Avatar user={user} />
        <span className="sr-only">Contul meu</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface-3 shadow-lg shadow-black/40"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm text-ink">{user.name ?? "Contul meu"}</p>
            <p className="truncate text-xs text-ink-3">{user.email}</p>
          </div>
          {/* docs/MCP.md §9 step 6 — account-level security, next to logout
              rather than in the main content nav (see NAV's own comment). */}
          <Link
            to="/connectors"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block border-b border-line px-4 py-3 text-left text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            Aplicații conectate
          </Link>
          {/* §D37 — Google refuză consimțământul în browserul unui Kobo, deci
              împerecherea prin cod are nevoie de propriul ei loc, lângă
              celelalte ecrane de securitate a contului. */}
          <Link
            to="/pair-kobo"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block border-b border-line px-4 py-3 text-left text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            Împerechere Kobo
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="w-full px-4 py-3 text-left text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:opacity-60"
          >
            {logout.isPending ? "Se deloghează…" : "Delogare"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Google's avatar URLs 403 when a referrer is sent, and a picture can vanish
 * at any time, so the initial is a real fallback rather than a nicety.
 */
function Avatar({ user }: { user: AuthUser }) {
  const [broken, setBroken] = useState(false);
  const initial = (user.name ?? user.email).trim().charAt(0).toUpperCase();

  if (user.avatarUrl && !broken) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-9 rounded-full border border-line object-cover"
      />
    );
  }

  return (
    <span className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 font-display text-sm text-accent">
      {initial}
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v18h5.5a1.5 1.5 0 0 0 1.5-1.5v-15Z"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
