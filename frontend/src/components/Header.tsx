import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import type { AuthUser } from "@bookcsi/shared";
import { useCurrentUser, useLogout } from "../api/auth";

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
];

const NAV_ITEM =
  "relative rounded-lg px-3 py-2 text-sm transition-colors duration-150 ";

export function Header({ onAddBook }: { onAddBook?: () => void }) {
  const { data: user } = useCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-0/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
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

        <div className="ml-auto flex items-center gap-3">
          {/* S1.1 — the manual form is reachable from every screen, and stays
              so after Sprint 4 adds Open Library beside it. */}
          {onAddBook && (
            <button
              type="button"
              onClick={onAddBook}
              className="rounded-lg border border-accent-quiet bg-accent-quiet/40 px-3.5 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
            >
              Adaugă o carte
            </button>
          )}
          {user && <AccountMenu user={user} />}
        </div>
      </div>
    </header>
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
