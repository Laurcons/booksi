import { useEffect, useMemo, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  matchLocale,
  translator,
  type AuthUser,
  type Locale,
} from "@bookcsi/shared";
import { CURRENT_USER_KEY, useCurrentUser } from "../api/auth";
import { apiFetch } from "../lib/api";
import { catalogs } from "./catalog";
import { LocaleContext, type LocaleContextValue } from "./locale-context";

/**
 * Which language the interface is in, and the `t()` that renders it (§D44).
 *
 * ## Where the answer comes from
 *
 * Two sources, in order, and the order is the whole design:
 *
 * 1. **The account**, once `GET /auth/me` has answered. This is authoritative:
 *    the user chose it, and it follows them to any browser.
 * 2. **The device**, until then — the first language in `navigator.languages`
 *    that we speak, else English.
 *
 * So a cold load can render one language and then switch, and that is accepted
 * rather than worked around. The alternative was caching the last known choice
 * in `localStorage` and reading it synchronously at boot, which was considered
 * and dropped: the window it closes is one API call long and contains exactly
 * one string — `BootScreen`'s — while the cost is a second source of truth for
 * the locale, a write that has to survive `queryClient.clear()` on logout, and a
 * stale value to reason about under impersonation. The mitigation list was
 * longer than the thing it mitigated.
 *
 * `navigator.languages` and the server's `Accept-Language` are the same
 * underlying browser setting read from two sides, and `matchLocale` is literally
 * the same function, so the two ends agree on step 2 without coordinating.
 */

/**
 * The device's answer, read once per load.
 *
 * `navigator.languages` rather than `navigator.language`: the plural is the
 * ordered preference list, and the singular is only its first entry — which
 * would make a device set to German-then-Romanian read as English rather than
 * Romanian.
 */
function deviceLocale(): Locale {
  return matchLocale(navigator.languages ?? [navigator.language]);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  // The account's choice the moment there is one, the device's until then. Not
  // held in state: `useCurrentUser` is already the single source for the user,
  // and a `useState` mirroring it would be a second copy to keep in step.
  const locale = user?.locale ?? deviceLocale();

  const switching = useMutation({
    mutationFn: (next: Locale) =>
      apiFetch<AuthUser>("/auth/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      }),
    // Optimistic, so the interface changes language on the click rather than on
    // the round trip. The server's answer replaces it either way, which is what
    // makes rolling back on failure unnecessary: `onSettled` re-reads the row.
    onMutate: (next) => {
      const previous = queryClient.getQueryData<AuthUser | null>(CURRENT_USER_KEY);

      if (previous) {
        queryClient.setQueryData(CURRENT_USER_KEY, { ...previous, locale: next });
      }

      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CURRENT_USER_KEY, context.previous);
      }
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(CURRENT_USER_KEY, fresh);
    },
  });

  // The document's own language, for screen readers, for the browser's offer to
  // translate the page, and for CSS hyphenation. Kept in step here because
  // `index.html` can only ship one value and the right one is not known until
  // this point.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Destructured so the memo depends on the two stable things it uses rather
  // than on the mutation object, whose identity changes on every render.
  const { mutate, isPending } = switching;

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: translator(locale, catalogs[locale]),
      setLocale: (next: Locale) => mutate(next),
      isSwitching: isPending,
    }),
    [locale, isPending, mutate],
  );

  return <LocaleContext value={value}>{children}</LocaleContext>;
}
