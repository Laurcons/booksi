import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@bookcsi/shared";
import { API_URL, apiFetch, UnauthorizedError } from "../lib/api";

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
