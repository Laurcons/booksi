import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useCurrentUser } from "../api/auth";
import { rememberReturnTo, takeReturnTo } from "../lib/return-to";

/**
 * Wraps every route that is not the login screen. The app never renders
 * anything belonging to a user before `GET /auth/me` has answered — a flash of
 * someone's library followed by a redirect would be both ugly and wrong.
 */
export function RequireAuth() {
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  const signedOut = !isPending && !isError && !user;
  const here = location.pathname + location.search;

  useEffect(() => {
    if (signedOut) {
      rememberReturnTo(here);
    }
  }, [signedOut, here]);

  useEffect(() => {
    if (!user) {
      return;
    }
    // Google always sends us back to the site root, so the path the user was
    // actually on has to be restored here, once (S0.2).
    const target = takeReturnTo();
    if (target && target !== here) {
      void navigate(target, { replace: true });
    }
  }, [user, here, navigate]);

  if (isPending) {
    return <BootScreen />;
  }

  if (isError) {
    // Not a session problem: bouncing to login would tell the user to fix
    // something that is not broken on their side.
    return <ApiUnreachable message={error.message} onRetry={() => void refetch()} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <p className="text-sm text-ink-3" role="status">
        Se încarcă…
      </p>
    </div>
  );
}

function ApiUnreachable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl text-ink">
          Serverul nu răspunde
        </h1>
        <p className="mt-3 text-sm text-ink-2">
          Nu am putut verifica dacă ești autentificat.
        </p>
        <p className="mt-1 text-xs text-ink-3">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
        >
          Încearcă din nou
        </button>
      </div>
    </div>
  );
}
