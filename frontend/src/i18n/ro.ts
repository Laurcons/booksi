/**
 * The Romanian catalog — and, by being the one that is written out in full, the
 * definition of what keys exist (§D44).
 *
 * `en.ts` is typed against `MessageKey`, so a message added here and forgotten
 * there fails the build. Romanian holds that role because it is the language the
 * app was written in, not because it outranks the other.
 *
 * ## Conventions
 *
 * - Keys are `area.thing.detail`, lowercase and dotted. The area matches roughly
 *   where the string is read, so a screen's copy is contiguous here.
 * - A message whose wording depends on a number is a `{ one, few, other }`
 *   object, and `Intl.PluralRules` picks the form — see `shared/src/i18n.ts`.
 *   Romanian needs all three (1 carte · 2–19 cărți · 20 **de** cărți); English
 *   fills only `one` and `other`.
 * - **Romanian singulars use the article, not the digit** — "o carte pe raft",
 *   never "1 carte pe raft". The hand-rolled `plural()` this replaced did that
 *   unconditionally (it returned `o ${one}`), and it was right to: a Romanian
 *   reader counting one of something says "o carte". English keeps the digit,
 *   which is why this cannot be a rule in the code and has to live in the copy.
 * - `{placeholder}` slots are filled from `t()`'s second argument. Numbers go in
 *   as written, so anything wanting thousands separators is formatted by the
 *   caller and passed as a string.
 * - Sentences are whole. A message split across two keys so that JSX can put a
 *   `<span>` in the middle cannot be reordered by a translator, and word order
 *   is exactly what differs between these two languages.
 */
export const ro = {
  /* -------------------------------------------------- shell */
  "nav.library": "Bibliotecă",
  "nav.wishlist": "Wishlist",
  "nav.gallery": "Galerie",
  "nav.budget": "Buget",
  "nav.stats": "Statistici",
  "nav.shelf": "Raft",
  "nav.challenge": "Provocare",
  "account.mine": "Contul meu",
  "nav.addBook": "Adaugă o carte",
  "nav.closeMenu": "Închide meniul",
  "nav.openMenu": "Deschide meniul",

  "account.connectors": "Aplicații conectate",
  "account.pairKobo": "Împerechere Kobo",
  "account.impersonate": "Impersonează utilizator",
  "account.logout": "Delogare",
  "account.loggingOut": "Se deloghează…",
  "account.language": "Limbă",

  "auth.impersonatingAs": "Ești autentificat ca acest cont, impersonat de {email}.",
  "auth.stopImpersonating": "Revino la contul tău",
  "auth.returning": "Se revine…",
  "auth.loading": "Se încarcă…",
  "auth.serverDown": "Serverul nu răspunde",
  "auth.cannotVerify": "Nu am putut verifica dacă ești autentificat.",

  "common.retry": "Încearcă din nou",
  "common.cancel": "Renunță",
  "common.save": "Salvează",
  "common.saving": "Se salvează…",
  "common.loadFailed": "Nu am putut încărca {what}.",

  /* -------------------------------------------------- status transitions */
  "status.next.purchased": "Am cumpărat-o",
  "status.next.reading": "Încep s-o citesc",
  "status.next.finished": "Am terminat-o",

  /* -------------------------------------------------- dashboard */
  "stats.booksFinished": "Cărți citite",
  "stats.booksReading": "În curs",
  "stats.pagesRead": "Pagini citite",
  "stats.spentThisMonth": "Cheltuit luna asta",
  "stats.averageRating": "Rating mediu",

  /* -------------------------------------------------- library */
  "library.title": "Biblioteca ta",
  /**
   * One sentence, not two halves joined by `{" "}` in the JSX as it was before.
   * Both counts are inside it, because English puts them in a different order
   * and a translator handed two fragments cannot fix that.
   */
  "library.summary":
    "Ai {reading} și {waiting}.",
  "library.summary.reading": {
    one: "o carte începută",
    few: "{count} cărți începute",
    other: "{count} de cărți începute",
  },
  "library.summary.waiting": {
    one: "o carte care te așteaptă",
    few: "{count} cărți care te așteaptă",
    other: "{count} de cărți care te așteaptă",
  },

  /* -------------------------------------------------- shelf & gallery counts */
  "shelf.count": {
    one: "o carte pe raft",
    few: "{count} cărți pe raft",
    other: "{count} de cărți pe raft",
  },
  "gallery.count": {
    one: "o carte",
    few: "{count} cărți",
    other: "{count} de cărți",
  },
  "gallery.countFiltered": {
    one: "o carte după filtrare",
    few: "{count} cărți după filtrare",
    other: "{count} de cărți după filtrare",
  },

  /* -------------------------------------------------- wishlist coverage (S3.3) */
  /**
   * The three shapes S3.3's sentence takes. Written as four whole messages
   * rather than assembled from a noun and a verb the way the Romanian-only code
   * did: that split existed *because* Romanian needs "de cărți" from 20 up and
   * puts the noun away from the count, which is a fact about Romanian and not a
   * structure English shares.
   */
  "wishlist.coverage.none": "Nicio carte n-are încă un preț estimat.",
  "wishlist.coverage.onlyOne": "Singura carte din wishlist are preț estimat.",
  "wishlist.coverage.all": {
    one: "Toate cele {count} cărți au preț estimat.",
    few: "Toate cele {count} cărți au preț estimat.",
    other: "Toate cele {count} de cărți au preț estimat.",
  },
  "wishlist.coverage.some": {
    one: "{priced} din {count} carte are preț estimat.",
    few: "{priced} din {count} cărți au preț estimat.",
    other: "{priced} din {count} de cărți au preț estimat.",
  },

  /* -------------------------------------------------- charts */
  /**
   * S7.2 asks for the books the chart leaves out, counted out loud. Whole
   * sentences because Romanian agrees the verb with the count in three places
   * ("nu apare"/"nu apar", "e numărată"/"sunt numărate") — the JSX used to carry
   * those as inline ternaries, which is a fact about Romanian that English does
   * not share.
   */
  "chart.reading.undated": {
    one: "o carte terminată n-are dată de terminare, deci nu apare în grafic — e numărată însă la „cărți citite”.",
    few: "{count} cărți terminate n-au dată de terminare, deci nu apar în grafic — sunt numărate însă la „cărți citite”.",
    other: "{count} de cărți terminate n-au dată de terminare, deci nu apar în grafic — sunt numărate însă la „cărți citite”.",
  },
  "chart.reading.tooltip.none": "nicio carte",
  "chart.reading.tooltip": {
    one: "o carte",
    few: "{count} cărți",
    other: "{count} de cărți",
  },

  "chart.spend.undated": {
    one: "o carte n-are dată de cumpărare ({amount} {currency}), deci nu apare în grafic — e însă în totalul de sus.",
    few: "{count} cărți n-au dată de cumpărare ({amount} {currency}), deci nu apar în grafic — sunt însă în totalul de sus.",
    other: "{count} de cărți n-au dată de cumpărare ({amount} {currency}), deci nu apar în grafic — sunt însă în totalul de sus.",
  },
  "chart.spend.others": {
    one: "și încă o carte",
    few: "și încă {count} cărți",
    other: "și încă {count} de cărți",
  },

  "spend.total.allDated": "Fiecare sumă are și o dată de cumpărare.",
  "spend.total.undated": {
    one: "Din care {amount} {currency} pe o carte fără dată de cumpărare.",
    few: "Din care {amount} {currency} pe {count} cărți fără dată de cumpărare.",
    other: "Din care {amount} {currency} pe {count} de cărți fără dată de cumpărare.",
  },

  /* -------------------------------------------------- challenge */
  "challenge.bookCount": {
    one: "o carte în provocare",
    few: "{count} cărți în provocare",
    other: "{count} de cărți în provocare",
  },
  "challenge.missingPages": {
    one: "o carte nu are număr de pagini — nu intră în calculul paginilor.",
    few: "{count} cărți nu au număr de pagini — nu intră în calculul paginilor.",
    other: "{count} de cărți nu au număr de pagini — nu intră în calculul paginilor.",
  },
  "challenge.daysLeft": {
    one: "o zi rămasă",
    few: "{count} zile rămase",
    other: "{count} de zile rămase",
  },
  "challenge.pagesOf": "{read} din {total} pagini",

  "budget.notANumber": "Scrie o sumă, sau lasă gol ca să renunți la buget.",

  /* -------------------------------------------------- months */
  "month.1": "ianuarie",
  "month.2": "februarie",
  "month.3": "martie",
  "month.4": "aprilie",
  "month.5": "mai",
  "month.6": "iunie",
  "month.7": "iulie",
  "month.8": "august",
  "month.9": "septembrie",
  "month.10": "octombrie",
  "month.11": "noiembrie",
  "month.12": "decembrie",

  "month.short.1": "ian.",
  "month.short.2": "feb.",
  "month.short.3": "mar.",
  "month.short.4": "apr.",
  "month.short.5": "mai",
  "month.short.6": "iun.",
  "month.short.7": "iul.",
  "month.short.8": "aug.",
  "month.short.9": "sep.",
  "month.short.10": "oct.",
  "month.short.11": "nov.",
  "month.short.12": "dec.",
} as const;

export type MessageKey = keyof typeof ro;
