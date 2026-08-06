import type { ReactNode } from "react";

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
 * swallowed: "nu am putut încărca" alone leaves nothing to act on, and a 401
 * has already been turned into a redirect long before this renders.
 */
export function LoadFailure({
  what,
  error,
  onRetry,
}: {
  what: string;
  error: Error;
  onRetry: () => void;
}) {
  return (
    <Note>
      <span className="text-ink-2">Nu am putut încărca {what}.</span>{" "}
      <span className="text-ink-3">{error.message}</span>{" "}
      <button
        type="button"
        onClick={onRetry}
        className="text-accent underline-offset-4 hover:underline"
      >
        Încearcă din nou
      </button>
    </Note>
  );
}
