import { useState } from "react";
import { useApprovePairing } from "../api/pairing";
import { errorMessage } from "../lib/api";
import { useT } from "../i18n/locale-context";

/**
 * §D37 / §Autentificare (docs/kobo_design.md) — the Kobo shows a short code,
 * and this screen, from an already-signed-in browser, is where it gets
 * approved. Whichever account submits here is the account the device signs
 * in as, which is why this sits behind `RequireAuth` like every other route:
 * there is no separate "choose an account" step, the current session *is*
 * the choice.
 */
export function PairKoboPage() {
  const t = useT();
  const [code, setCode] = useState("");
  const approve = useApprovePairing();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    approve.mutate({ code });
  };

  if (approve.isSuccess) {
    return (
      <main className="mx-auto max-w-sm px-6 py-10 text-center">
        <h1 className="font-display text-2xl text-ink">{t("pair.codeApproved")}</h1>
        <p className="mt-3 text-sm text-ink-2">
          {t("pair.done")}
        </p>
        <button
          type="button"
          onClick={() => {
            approve.reset();
            setCode("");
          }}
          className="mt-6 rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        >
          {t("pair.again")}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-10">
      <h1 className="font-display text-2xl text-ink">{t("pair.title")}</h1>
      <p className="mt-2 text-sm text-ink-2">
        {t("pair.body")}
      </p>

      <form onSubmit={submit} noValidate className="mt-6">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">{t("pair.code")}</span>
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="ABC 123"
            className="w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-center font-mono text-lg uppercase tracking-widest text-ink outline-none transition-colors duration-150 focus:border-accent"
            aria-label={t("pair.codeLabel")}
          />
        </label>

        {approve.isError && (
          <p role="alert" className="mt-3 text-sm text-error">
            {errorMessage(approve.error, t("pair.failed"))}
          </p>
        )}

        <button
          type="submit"
          disabled={approve.isPending || code.trim() === ""}
          className="mt-4 w-full rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60"
        >
          {approve.isPending ? t("common.approving") : t("common.approve")}
        </button>
      </form>
    </main>
  );
}
