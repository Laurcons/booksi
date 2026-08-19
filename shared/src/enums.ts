import { z } from "zod";
import { type Locale } from "./locale.js";

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

/**
 * The label maps §D21 predicted, now one per language (§D44).
 *
 * These are the part of §D21's promise that held: the enum values never had to
 * change, and a second language really did cost only a second column here. It
 * was the *rest* of the prediction — that the maps would be the only thing to
 * duplicate — that turned out to be wrong.
 *
 * Written as maps rather than folded into `messages.ts` so a label stays next
 * to the value it labels: adding a category to `GENRE_VALUES` and forgetting to
 * name it is a type error in the same file, three lines down.
 */
export const STATUS_LABELS: Record<Locale, Record<Status, string>> = {
  ro: {
    WISHLIST: "Wishlist",
    PURCHASED: "Cumpărat",
    READING: "Citesc",
    FINISHED: "Terminat",
    ABANDONED: "Abandonat",
  },
  en: {
    WISHLIST: "Wishlist",
    PURCHASED: "Purchased",
    READING: "Reading",
    FINISHED: "Finished",
    ABANDONED: "Abandoned",
  },
};

/**
 * §D39's 29 topic categories — a bookshop's shelving scheme, so the English
 * side is the shelf sign a reader would look for rather than a literal
 * translation: `ROMANIAN_MAGAZINES` is "Magazines — Romanian", not "Reviews".
 */
export const GENRE_LABELS: Record<Locale, Record<Genre, string>> = {
  ro: {
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
  },
  en: {
    AUDIOBOOKS: "Audiobooks",
    CULINARY: "Cooking",
    ART_ARCHITECTURE: "Art & architecture",
    ENCYCLOPEDIAS: "Encyclopedias",
    BIOGRAPHIES: "Biography, memoir & diaries",
    LINGUISTICS_DICTIONARIES: "Linguistics & dictionaries",
    ROMANIAN_MAGAZINES: "Magazines — Romanian",
    FOREIGN_LANGUAGES: "Foreign languages",
    POETRY_THEATRE: "Poetry, theatre & literary studies",
    FICTION: "Fiction",
    COMICS: "Comics & graphic novels",
    TRAVEL_GUIDES: "Travel guides, maps & atlases",
    HISTORY: "History",
    RELIGION: "Religion",
    PHILOSOPHY: "Philosophy",
    PSYCHOLOGY: "Psychology",
    SOCIAL_SCIENCES_POLITICS: "Social sciences & politics",
    MARKETING_COMMUNICATION: "Marketing & communication",
    BUSINESS_ECONOMY: "Business & economics",
    LAW: "Law",
    MEDICINE: "Medicine",
    EXACT_SCIENCES_MATH: "Exact sciences & mathematics",
    NATURE_ENVIRONMENT: "Nature & environment",
    TECHNOLOGY: "Engineering & technology",
    COMPUTERS_INTERNET: "Computers & internet",
    HEALTH_SELF_DEVELOPMENT: "Health & personal development",
    LIFESTYLE_SPORT_LEISURE: "Lifestyle, sport & leisure",
    ROMANIA: "Romania",
    EDUCATIONAL_SOFTWARE: "Educational software",
  },
};

/**
 * The two lookups as functions, because that is how every call site reads them
 * — one status, one language — and because a nested subscript at the point of
 * use (`GENRE_LABELS[locale][genre]`) puts the two indices in the opposite
 * order from the question being asked.
 */
export function statusLabel(status: Status, locale: Locale): string {
  return STATUS_LABELS[locale][status];
}

export function genreLabel(genre: Genre, locale: Locale): string {
  return GENRE_LABELS[locale][genre];
}
