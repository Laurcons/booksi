import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useCurrentUser, useStopImpersonating } from "../api/auth";
import { rememberReturnTo, takeReturnTo } from "../lib/return-to";
import { useT } from "../i18n/locale-context";

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

  return (
    <>
      {user.impersonatedBy && <ImpersonationBanner impersonatedBy={user.impersonatedBy} />}
      <Outlet />
    </>
  );
}

/**
 * §D38 — shown on every authenticated route while a session is an admin
 * impersonating someone else, so it's never mistaken for the admin's own.
 */
function ImpersonationBanner({
  impersonatedBy,
}: {
  impersonatedBy: { id: string; email: string };
}) {
  const t = useT();
  const stopImpersonating = useStopImpersonating();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-status-abandoned/40 bg-status-abandoned/10 px-6 py-2 text-sm text-ink">
      {/* One sentence with the address inside it, not two fragments around a
          <strong>: English puts the clause in a different order (§D44). */}
      <span>{t("auth.impersonatingAs", { email: impersonatedBy.email })}</span>
      <button
        type="button"
        disabled={stopImpersonating.isPending}
        onClick={() => stopImpersonating.mutate()}
        className="shrink-0 rounded-lg border border-line bg-surface-2 px-3 py-1 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-3 disabled:opacity-60"
      >
        {stopImpersonating.isPending
          ? t("auth.returning")
          : t("auth.stopImpersonating")}
      </button>
    </div>
  );
}

function BootScreen() {
  const t = useT();
  return (
    <div className="grid min-h-dvh place-items-center">
      <p className="text-sm text-ink-3" role="status">
        {t("auth.loading")}
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
  const t = useT();
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl text-ink">
          {t("auth.serverDown")}
        </h1>
        <p className="mt-3 text-sm text-ink-2">
          {t("auth.cannotVerify")}
        </p>
        <p className="mt-1 text-xs text-ink-3">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
        >
          {t("common.retry")}
        </button>
      </div>
    </div>
  );
}
