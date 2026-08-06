import { z } from "zod";

/**
 * These mirror the Prisma enums exactly. They live here rather than being
 * imported from `@prisma/client` so the frontend never has to depend on the
 * ORM, and so a divergence shows up as a type error on the next build.
 */

export const STATUS_VALUES = [
  "WISHLIST",
  "PURCHASED",
  "READING",
  "FINISHED",
  "ABANDONED",
] as const;

export const statusSchema = z.enum(STATUS_VALUES);
export type Status = z.infer<typeof statusSchema>;

/** Fixed list, one value per book — see §D17 and §D19. */
export const GENRE_VALUES = [
  "FICTION",
  "SCIFI",
  "FANTASY",
  "THRILLER",
  "ROMANCE",
  "HISTORICAL",
  "MEMOIR",
  "NONFICTION",
  "SELF_HELP",
  "BUSINESS",
  "SCIENCE",
  "PHILOSOPHY",
  "PSYCHOLOGY",
  "POETRY",
  "COMICS_MANGA",
  "CHILDREN_YA",
  "OTHER",
] as const;

export const genreSchema = z.enum(GENRE_VALUES);
export type Genre = z.infer<typeof genreSchema>;

/** UI copy is Romanian; identifiers are not (§D21). */
export const STATUS_LABEL: Record<Status, string> = {
  WISHLIST: "Wishlist",
  PURCHASED: "Cumpărat",
  READING: "Citesc",
  FINISHED: "Terminat",
  ABANDONED: "Abandonat",
};

export const GENRE_LABEL: Record<Genre, string> = {
  FICTION: "Ficțiune",
  SCIFI: "SF",
  FANTASY: "Fantasy",
  THRILLER: "Thriller / Mister",
  ROMANCE: "Romance",
  HISTORICAL: "Roman istoric",
  MEMOIR: "Biografie / Memorii",
  NONFICTION: "Non-ficțiune",
  SELF_HELP: "Dezvoltare personală",
  BUSINESS: "Business / Economie",
  SCIENCE: "Științe",
  PHILOSOPHY: "Filosofie",
  PSYCHOLOGY: "Psihologie",
  POETRY: "Poezie",
  COMICS_MANGA: "Bandă desenată / Manga",
  CHILDREN_YA: "Copii / Young Adult",
  OTHER: "Altele",
};
