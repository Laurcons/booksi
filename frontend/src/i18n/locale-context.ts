import { createContext, useContext } from "react";
import type { Locale, Vars } from "@bookcsi/shared";
import type { MessageKey } from "./catalog";

/**
 * The locale context and the hooks that read it (§D44).
 *
 * Split from `LocaleProvider.tsx` for the reason `wishlist-coverage.ts` records
 * about itself: React's fast refresh only works on a module whose exports are
 * all components, so a file holding both the provider and these hooks makes
 * every edit to either one a full reload.
 */

export type LocaleContextValue = {
  locale: Locale;
  t: (key: MessageKey, vars?: Vars) => string;
  setLocale: (locale: Locale) => void;
  isSwitching: boolean;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);

  if (value === null) {
    // A component rendering text outside the provider would silently get one
    // language forever, which is the kind of bug that reaches production.
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }

  return value;
}

/** The common case, so it does not need destructuring at every call site. */
export function useT(): (key: MessageKey, vars?: Vars) => string {
  return useLocale().t;
}
