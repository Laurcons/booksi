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

/**
 * Fixed list, one value per book — see §D17 and §D19. §D39 replaced the
 * original 17-value literary-genre list with this one: 29 topic categories
 * (a bookshop's own shelving scheme, not a literary taxonomy), and the
 * identifier stays `Genre`/`genre` even though the UI now calls it
 * "categorie" — renaming the column and every type along with it bought
 * nothing a reader couldn't already tell from `GENRE_LABEL`.
 */
export const GENRE_VALUES = [
  "AUDIOBOOKS",
  "CULINARY",
  "ART_ARCHITECTURE",
  "ENCYCLOPEDIAS",
  "BIOGRAPHIES",
  "LINGUISTICS_DICTIONARIES",
  "ROMANIAN_MAGAZINES",
  "FOREIGN_LANGUAGES",
  "POETRY_THEATRE",
  "FICTION",
  "COMICS",
  "TRAVEL_GUIDES",
  "HISTORY",
  "RELIGION",
  "PHILOSOPHY",
  "PSYCHOLOGY",
  "SOCIAL_SCIENCES_POLITICS",
  "MARKETING_COMMUNICATION",
  "BUSINESS_ECONOMY",
  "LAW",
  "MEDICINE",
  "EXACT_SCIENCES_MATH",
  "NATURE_ENVIRONMENT",
  "TECHNOLOGY",
  "COMPUTERS_INTERNET",
  "HEALTH_SELF_DEVELOPMENT",
  "LIFESTYLE_SPORT_LEISURE",
  "ROMANIA",
  "EDUCATIONAL_SOFTWARE",
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
  AUDIOBOOKS: "Audiobooks",
  CULINARY: "Culinare",
  ART_ARCHITECTURE: "Artă, arhitectură",
  ENCYCLOPEDIAS: "Enciclopedii",
  BIOGRAPHIES: "Biografii, memorii, jurnale",
  LINGUISTICS_DICTIONARIES: "Lingvistică, dicționare",
  ROMANIAN_MAGAZINES: "Reviste - Limba română",
  FOREIGN_LANGUAGES: "Limbi străine",
  POETRY_THEATRE: "Poezie, teatru, studii literare",
  FICTION: "Ficțiune",
  COMICS: "Benzi desenate",
  TRAVEL_GUIDES: "Ghiduri și hărți turistice, atlase",
  HISTORY: "Istorie",
  RELIGION: "Religie",
  PHILOSOPHY: "Filosofie",
  PSYCHOLOGY: "Psihologie",
  SOCIAL_SCIENCES_POLITICS: "Științe sociale. Politică",
  MARKETING_COMMUNICATION: "Marketing și comunicare",
  BUSINESS_ECONOMY: "Business și economie",
  LAW: "Drept",
  MEDICINE: "Medicină",
  EXACT_SCIENCES_MATH: "Științe exacte. Matematici",
  NATURE_ENVIRONMENT: "Natură și mediu",
  TECHNOLOGY: "Tehnică și tehnologie",
  COMPUTERS_INTERNET: "Computere și internet",
  HEALTH_SELF_DEVELOPMENT: "Sănătate, dezvoltare personală",
  LIFESTYLE_SPORT_LEISURE: "Lifestyle, sport, timp liber",
  ROMANIA: "România",
  EDUCATIONAL_SOFTWARE: "Soft educațional",
};
