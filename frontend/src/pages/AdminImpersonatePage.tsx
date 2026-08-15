import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { MIN_ADMIN_SEARCH_LENGTH, useCurrentUser, useImpersonate, useSearchAdminUsers } from "../api/auth";
import { errorMessage } from "../lib/api";
import { useDebounced } from "../lib/use-debounced";

const SEARCH_FAILED = "Căutarea a eșuat. Încearcă din nou.";

/**
 * §D38 — admin-only. The backend's `AdminGuard` is the real enforcement; the
 * redirect below is just so a non-admin who guesses the URL doesn't sit on a
 * broken page.
 */
export function AdminImpersonatePage() {
  const { data: user } = useCurrentUser();

  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <AdminImpersonateScreen />;
}

function AdminImpersonateScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const results = useSearchAdminUsers(debounced);
  const impersonate = useImpersonate();

  const open = debounced.trim().length >= MIN_ADMIN_SEARCH_LENGTH;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-2xl text-ink">Impersonează utilizator</h1>
      <p className="mt-2 text-sm text-ink-2">
        Preia sesiunea unui alt cont, pentru depanare. Te poți întoarce oricând la contul tău din
        bannerul afișat cât timp impersonezi.
      </p>

      <label className="mt-8 block">
        <span className="mb-1.5 block text-sm text-ink-2">Caută după email</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="cineva@example.com"
          autoComplete="off"
          className="w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent"
        />
      </label>

      {open && (
        <div className="mt-4">
          {results.isPending && (
            <p className="text-sm text-ink-3" role="status">
              Se caută…
            </p>
          )}

          {results.isError && (
            <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
              <p className="text-sm text-ink-2">{errorMessage(results.error, SEARCH_FAILED)}</p>
              <button
                type="button"
                onClick={() => void results.refetch()}
                className="mt-3 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
              >
                Încearcă din nou
              </button>
            </div>
          )}

          {results.data && results.data.length === 0 && (
            <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
              Niciun cont găsit.
            </p>
          )}

          {results.data && results.data.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface-2">
              {results.data.map((candidate) => (
                <li key={candidate.id} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {candidate.name ?? candidate.email}
                    </p>
                    {candidate.name && (
                      <p className="mt-0.5 truncate text-xs text-ink-3">{candidate.email}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={impersonate.isPending}
                    onClick={() =>
                      impersonate.mutate(candidate.id, {
                        onSuccess: () => void navigate("/"),
                      })
                    }
                    className="shrink-0 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60"
                  >
                    Impersonează
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
