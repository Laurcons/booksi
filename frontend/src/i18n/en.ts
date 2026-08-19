import type { Catalog } from "@bookcsi/shared";
import type { MessageKey } from "./ro";

/**
 * The English catalog, typed against `ro.ts`'s keys (§D44) — so a message added
 * on one side and forgotten on the other is a compile error rather than a bare
 * key on someone's screen.
 *
 * English needs only `one` and `other` for plurals; `few` is never selected for
 * it, and `translate` falls back to `other` for any category a locale leaves
 * out. That fallback is what lets the two languages share one type despite
 * disagreeing about how many plural forms exist.
 */
export const en: Catalog<MessageKey> = {
  /* -------------------------------------------------- shell */
  "nav.library": "Library",
  "nav.wishlist": "Wishlist",
  "nav.gallery": "Gallery",
  "nav.budget": "Budget",
  "nav.stats": "Statistics",
  "nav.shelf": "Shelf",
  "nav.challenge": "Challenge",
  "account.mine": "My account",
  "nav.addBook": "Add a book",
  "nav.closeMenu": "Close menu",
  "nav.openMenu": "Open menu",

  "account.connectors": "Connected apps",
  "account.pairKobo": "Pair a Kobo",
  "account.impersonate": "Impersonate a user",
  "account.logout": "Sign out",
  "account.loggingOut": "Signing out…",
  "account.language": "Language",

  "auth.impersonatingAs":
    "You are signed in as this account, impersonated by {email}.",
  "auth.stopImpersonating": "Back to your own account",
  "auth.returning": "Going back…",
  "auth.loading": "Loading…",
  "auth.serverDown": "The server is not answering",
  "auth.cannotVerify": "We could not check whether you are signed in.",

  "common.retry": "Try again",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.loadFailed": "We could not load {what}.",

  /* -------------------------------------------------- status transitions */
  // First person, matching the Romanian: these are buttons the reader presses
  // to say what they did, not labels describing the book.
  "status.next.purchased": "I bought it",
  "status.next.reading": "I'm starting it",
  "status.next.finished": "I finished it",

  /* -------------------------------------------------- dashboard */
  "stats.booksFinished": "Books read",
  "stats.booksReading": "In progress",
  "stats.pagesRead": "Pages read",
  "stats.spentThisMonth": "Spent this month",
  "stats.averageRating": "Average rating",

  /* -------------------------------------------------- library */
  "library.title": "Your library",
  "library.summary": "You have {reading} and {waiting}.",
  "library.summary.reading": {
    one: "{count} book started",
    other: "{count} books started",
  },
  "library.summary.waiting": {
    one: "{count} book waiting for you",
    other: "{count} books waiting for you",
  },

  /* -------------------------------------------------- shelf & gallery counts */
  "shelf.count": {
    one: "{count} book on the shelf",
    other: "{count} books on the shelf",
  },
  "gallery.count": {
    one: "{count} book",
    other: "{count} books",
  },
  "gallery.countFiltered": {
    one: "{count} book after filtering",
    other: "{count} books after filtering",
  },

  /* -------------------------------------------------- wishlist coverage (S3.3) */
  "wishlist.coverage.none": "No book has an estimated price yet.",
  "wishlist.coverage.onlyOne":
    "The only book on the wishlist has an estimated price.",
  "wishlist.coverage.all": {
    one: "All {count} books have an estimated price.",
    other: "All {count} books have an estimated price.",
  },
  "wishlist.coverage.some": {
    one: "{priced} of {count} book has an estimated price.",
    other: "{priced} of {count} books have an estimated price.",
  },

  /* -------------------------------------------------- charts */
  "chart.reading.undated": {
    one: "{count} finished book has no finish date, so it does not appear on the chart — it is still counted under “books read”.",
    other: "{count} finished books have no finish date, so they do not appear on the chart — they are still counted under “books read”.",
  },
  "chart.reading.tooltip.none": "no books",
  "chart.reading.tooltip": {
    one: "{count} book",
    other: "{count} books",
  },

  "chart.spend.undated": {
    one: "{count} book has no purchase date ({amount} {currency}), so it does not appear on the chart — it is in the total above, though.",
    other: "{count} books have no purchase date ({amount} {currency}), so they do not appear on the chart — they are in the total above, though.",
  },
  "chart.spend.others": {
    one: "and {count} more book",
    other: "and {count} more books",
  },

  "spend.total.allDated": "Every amount has a purchase date too.",
  "spend.total.undated": {
    one: "Of which {amount} {currency} on {count} book with no purchase date.",
    other: "Of which {amount} {currency} on {count} books with no purchase date.",
  },

  /* -------------------------------------------------- challenge */
  "challenge.bookCount": {
    one: "{count} book in the challenge",
    other: "{count} books in the challenge",
  },
  "challenge.missingPages": {
    one: "{count} book has no page count — it is left out of the page maths.",
    other: "{count} books have no page count — they are left out of the page maths.",
  },
  "challenge.daysLeft": {
    one: "{count} day left",
    other: "{count} days left",
  },
  "challenge.pagesOf": "{read} of {total} pages",

  "budget.notANumber": "Write an amount, or leave it empty to drop the budget.",

  /* -------------------------------------------------- months */
  "month.1": "January",
  "month.2": "February",
  "month.3": "March",
  "month.4": "April",
  "month.5": "May",
  "month.6": "June",
  "month.7": "July",
  "month.8": "August",
  "month.9": "September",
  "month.10": "October",
  "month.11": "November",
  "month.12": "December",

  "month.short.1": "Jan",
  "month.short.2": "Feb",
  "month.short.3": "Mar",
  "month.short.4": "Apr",
  "month.short.5": "May",
  "month.short.6": "Jun",
  "month.short.7": "Jul",
  "month.short.8": "Aug",
  "month.short.9": "Sep",
  "month.short.10": "Oct",
  "month.short.11": "Nov",
  "month.short.12": "Dec",
};
