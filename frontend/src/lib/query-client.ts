import { QueryCache, QueryClient } from "@tanstack/react-query";
import { CURRENT_USER_KEY } from "../api/auth";
import { UnauthorizedError } from "./api";

/**
 * A session can expire while the app is open. Whichever query notices first
 * marks the user as signed out; `RequireAuth` is watching that entry and takes
 * care of the redirect, so no single call site has to handle it.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof UnauthorizedError) {
        queryClient.setQueryData(CURRENT_USER_KEY, null);
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Retrying a 401 just delays the redirect.
      retry: (failureCount, error) =>
        !(error instanceof UnauthorizedError) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});
