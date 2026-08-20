import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useApproveConsent, useConsentRequest } from "../api/mcp";
import { errorMessage } from "../lib/api";
import type { TFunction } from "../i18n/catalog";
import { useT } from "../i18n/locale-context";

/**
 * The consent screen `GET /oauth/authorize` redirects to once a user is
 * signed in (docs/MCP.md §3, §9 step 3). Sits behind `RequireAuth` like every
 * other route — a missing session bounces to `/login` and back here via the
 * existing `return-to` mechanism, no extra plumbing needed.
 */
export function McpConsentPage() {
  const t = useT();
  const [params] = useSearchParams();
  const req = params.get("req");

  if (!req) {
    return (
      <ConsentShell>
        <p className="text-sm text-ink-2">
          {t("consent.missing")}
        </p>
      </ConsentShell>
    );
  }

  return <ConsentPrompt req={req} />;
}

function ConsentPrompt({ req }: { req: string }) {
  const t = useT();
  const consent = useConsentRequest(req);
  const approve = useApproveConsent(req);

  if (consent.isPending) {
    return (
      <ConsentShell>
        <p className="text-sm text-ink-3" role="status">
          {t("common.loading")}
        </p>
      </ConsentShell>
    );
  }

  if (consent.isError) {
    return (
      <ConsentShell>
        <p role="alert" className="text-sm text-status-abandoned">
          {errorMessage(
            consent.error,
            t("consent.requestInvalid"),
          )}
        </p>
      </ConsentShell>
    );
  }

  const { clientName, scope, redirectUri, state } = consent.data;

  const deny = () => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) {
      url.searchParams.set("state", state);
    }
    window.location.href = url.toString();
  };

  return (
    <ConsentShell>
      <h1 className="font-display text-2xl text-ink">
        {clientName} vrea acces la biblioteca ta
      </h1>
      <p className="mt-3 text-sm text-ink-2">
        {scopeDescription(scope, t)}
      </p>

      {approve.error && (
        <p role="alert" className="mt-4 text-sm text-status-abandoned">
          {t("consent.failed", {
            message: errorMessage(approve.error, t("common.retry")),
          })}
        </p>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={deny}
          disabled={approve.isPending}
          className="rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink disabled:opacity-60"
        >
          {t("consent.deny")}
        </button>
        <button
          type="button"
          disabled={approve.isPending}
          onClick={() =>
            approve.mutate(undefined, {
              onSuccess: (data) => {
                window.location.href = data.redirectUrl;
              },
            })
          }
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface-0 transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
        >
          {approve.isPending ? t("consent.connecting") : t("consent.approve")}
        </button>
      </div>
    </ConsentShell>
  );
}

/**
 * One scope exists today (docs/MCP.md §8) — spelled out, not shown as a raw
 * token.
 *
 * Takes `t` rather than calling `useT()`: this is a plain function, not a
 * component, so a hook inside it would break the rules of hooks (and did, until
 * `oxlint` said so).
 */
function scopeDescription(scope: string, t: TFunction): string {
  return scope.includes("library")
    ? t("consent.scope")
    : t("consent.scopeOther", { scope });
}

function ConsentShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );
}
