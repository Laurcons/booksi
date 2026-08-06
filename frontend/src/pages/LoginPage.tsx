import { Navigate, useSearchParams } from "react-router";
import { GOOGLE_LOGIN_URL, useCurrentUser } from "../api/auth";

/**
 * The only unauthenticated screen. Google is the single way in (S0.1) — there
 * is no password form to fall back to, so this page is deliberately one
 * decision wide.
 */
export function LoginPage() {
  const { data: user, isPending } = useCurrentUser();
  const [params] = useSearchParams();

  if (isPending) {
    return <div className="min-h-dvh" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <BookMark />

        <h1 className="mt-6 font-display text-4xl text-ink">
          Bookcsi<span className="text-accent">.</span>
        </h1>
        <p className="mt-3 text-ink-2">
          Biblioteca ta, <span className="font-display italic">așa cum o ții minte</span>.
        </p>

        {loginError(params.get("error")) && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2"
          >
            {loginError(params.get("error"))}
          </p>
        )}

        {/* A link, not a button with fetch: OAuth needs a top-level navigation
            that Google can redirect back from. */}
        <a
          href={GOOGLE_LOGIN_URL}
          className="mt-8 flex items-center justify-center gap-3 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-surface-0 transition-colors duration-150 hover:bg-accent-hover"
        >
          <GoogleMark />
          Continuă cu Google
        </a>

        <p className="mt-6 text-xs text-ink-3">
          Nu-ți cerem o parolă nouă și nu citim nimic din contul tău Google în
          afară de nume, e-mail și poză.
        </p>
      </div>
    </main>
  );
}

/**
 * The reasons `OAuthFailureFilter` can send somebody back here, in the two
 * shapes it distinguishes. They need different words: "try again" is the right
 * advice after a failed sign-in and precisely the wrong advice after being rate
 * limited, where trying again is the thing that just got refused.
 *
 * An unrecognised code shows nothing at all rather than a generic apology —
 * arriving at a login screen is not by itself evidence anything went wrong.
 */
function loginError(code: string | null): string | null {
  switch (code) {
    case "auth":
      return "Autentificarea nu a reușit. Mai încearcă o dată.";
    case "rate":
      return "Prea multe încercări de autentificare. Așteaptă un minut și încearcă din nou.";
    default:
      return null;
  }
}

/** White disc so the brand mark keeps its own colours on the brass button. */
function GoogleMark() {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white">
      <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden>
        <path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z"
        />
        <path
          fill="#FBBC05"
          d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
        />
        <path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
        />
      </svg>
    </span>
  );
}

function BookMark() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      className="mx-auto"
      aria-hidden
    >
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
