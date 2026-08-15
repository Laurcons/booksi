import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminUserSummary, AuthUser } from "@bookcsi/shared";
import { API_URL, apiFetch, UnauthorizedError } from "../lib/api";

/** §D38 — the admin picker's search asks for at least this many characters. */
export const MIN_ADMIN_SEARCH_LENGTH = 2;

export const CURRENT_USER_KEY = ["auth", "me"] as const;

/**
 * Not a fetch call: OAuth needs a full page navigation, because Google has to
 * see a top-level request it can redirect back from. An XHR would be blocked.
 */
export const GOOGLE_LOGIN_URL = `${API_URL}/auth/google`;

/**
 * `null` means "not signed in" — an ordinary answer to the boot question, not
 * an error state. Everything else (API down, 500) stays an error, so the two
 * cases can be told apart on screen.
 */
export function useCurrentUser() {
  return useQuery<AuthUser | null>({
    queryKey: CURRENT_USER_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<AuthUser>("/auth/me");
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      // Even if the request failed, drop every cached answer: the library of
      // the person who just left must not be visible to whoever logs in next.
      queryClient.setQueryData(CURRENT_USER_KEY, null);
      queryClient.clear();
    },
  });
}

/**
 * §D38 — an admin takes on another account's session. The whole cache is
 * dropped on success, same as `useLogout`: the admin's own library/settings
 * must not bleed into the impersonated view, and vice versa on the way back.
 */
export function useImpersonate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/auth/impersonate/${userId}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

/** §D38 — the way back out of `useImpersonate`. */
export function useStopImpersonating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/stop-impersonating", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

/** §D38 — backs the admin picker's search box. */
export function useSearchAdminUsers(q: string) {
  const trimmed = q.trim();

  return useQuery({
    queryKey: ["auth", "admin", "users", trimmed] as const,
    queryFn: () =>
      apiFetch<AdminUserSummary[]>(
        `/auth/admin/users?q=${encodeURIComponent(trimmed)}`,
      ),
    enabled: trimmed.length >= MIN_ADMIN_SEARCH_LENGTH,
    retry: false,
  });
}
