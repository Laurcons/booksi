/**
 * §Componente/Navigație (docs/kobo_design.md) — a banded row of bordered text
 * links, current destination marked with the thicker accent border, unbuilt
 * ones shown as disabled text rather than a dead link. Same six destinations
 * and the same idiom `frontend/src/components/Header.tsx`'s `NAV` uses; only
 * one of the six exists here so far.
 */
export interface NavItem {
  label: string;
  href: string | null;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Cărți", href: "/books" },
  { label: "Galerie", href: null },
  { label: "Raft", href: null },
  { label: "Wishlist", href: null },
  { label: "Buget", href: null },
  { label: "Statistici", href: null },
];
