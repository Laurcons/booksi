import type { ReactNode } from "react";
import { useT } from "../i18n/locale-context";

/**
 * The quiet one-line strip a page shows while it is loading or when it could
 * not load. Shared by the library and the wishlist (S3.1), which are the same
 * screen with a different filter and would otherwise carry two copies of it.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-line bg-surface-1 px-4 py-3 text-sm text-ink-3">
      {children}
    </p>
  );
}

/**
 * A failed load, with the way out of it. The message is shown rather than
 * swallowed: `common.loadFailed` alone leaves nothing to act on, and a 401
 * has already been turned into a redirect long before this renders.
 */
export function LoadFailure({
  what,
  error,
  onRetry,
}: {
  /** Already translated by the caller — the name of the thing that failed. */
  what: string;
  error: Error;
  onRetry: () => void;
}) {
  const t = useT();

  return (
    <Note>
      <span className="text-ink-2">{t("common.loadFailed", { what })}</span>{" "}
      <span className="text-ink-3">{error.message}</span>{" "}
      <button
        type="button"
        onClick={onRetry}
        className="text-accent underline-offset-4 hover:underline"
      >
        {t("common.retry")}
      </button>
    </Note>
  );
}
