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

  /* -------------------------------------------------- common */
  "common.close": "Close",
  "common.delete": "Delete",
  "common.deleting": "Deleting…",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.create": "Create",
  "common.creating": "Creating…",
  "common.approve": "Approve",
  "common.approving": "Approving…",
  "common.searching": "Searching…",
  "common.loading": "Loading…",

  /* -------------------------------------------------- a book's own fields */
  "book.cover": "Cover",
  "book.coverOf": "Cover of {title}",
  "book.publicationYear": "Year published",
  "book.totalPages": "Page count",
  "book.price": "Price",
  "book.estimatedPrice": "Estimated price",
  "book.paidPrice": "Price paid",
  "book.purchasedOn": "Bought",
  "book.startedOn": "Started",
  "book.finishedOn": "Finished",
  "book.addedOn": "Added",
  "book.favorite": "Favourite",
  "book.markFavorite": "Mark as a favourite",
  "book.noRating": "not rated",

  /* -------------------------------------------------- the add/edit form */
  "bookForm.editTitle": "Edit book",
  "bookForm.addTitle": "New book",
  "bookForm.fromOpenLibrary": "Filled in from Open Library. Correct any field.",
  "bookForm.olUnavailable":
    "Open Library is not answering. Fill the fields in by hand.",
  "bookForm.searchingIsbn": "Looking the ISBN up on Open Library…",
  "bookForm.scanBarcode": "Scan the barcode",
  "bookForm.noCategory": "— no category —",

  /* the four tabs */
  "bookForm.tab.book": "Book",
  "bookForm.tab.description": "Description",
  "bookForm.tab.reading": "Reading",
  "bookForm.tab.verdict": "Verdict",
  "bookForm.tabChanged": "has unsaved changes",
  "bookForm.tabInvalid": "has a field to fix",

  /* what a locked field says on hover */
  "bookForm.lockedProgress": "Opens once the book is with you",
  "bookForm.lockedStarted": "Opens once the book reaches you",
  "bookForm.lockedFinished": "Opens once you start the book",
  "bookForm.lockedPaid": "Opens after you buy it",
  "bookForm.lockedRating": "Stars belong on “Finished” or “Abandoned”",

  "bookForm.changeCover": "Change the cover",
  "bookForm.markFinished": "I finished it",
  "bookForm.today": "Today",
  "bookForm.charCount": "{count} / {max}",

  /* -------------------------------------------------- the table */
  "table.actions": "Actions",
  "table.sortBy": "Sort by",
  "table.asc": "Ascending",
  "table.desc": "Descending",

  /* -------------------------------------------------- the barcode scanner */
  "scan.instruction": "Show the barcode on the back of the book.",
  "scan.starting": "Starting the camera…",
  "scan.videoLabel": "Camera view",
  "scan.unsupported":
    "This browser gives no camera access. Type the ISBN in by hand.",
  "scan.needsHttps": "The camera only works over HTTPS. Type the ISBN in by hand.",
  "scan.failed": "The camera could not start. Type the ISBN in by hand.",
  "scan.denied":
    "Camera access was refused. You can allow it in your browser settings, or type the ISBN in by hand.",
  "scan.noCamera": "No camera found. Type the ISBN in by hand.",

  /* -------------------------------------------------- search boxes */
  "search.library": "Search the library",
  "search.books": "Search books",
  "search.byBookFields": "Search by title, author, publisher, ISBN…",
  "search.wishlist": "Search the wishlist…",
  "search.byEmail": "Search by email",
  "search.openLibrary": "Search Open Library",
  "search.noCategoryMatches": "No category matches.",
  "category.searchPlaceholder": "Search categories…",
  "category.remove": "Remove {label}",

  "field.title": "Title",
  "field.author": "Author",
  "field.status": "Status",
  "field.categories": "Categories",
  "field.review": "Review",
  "field.reviewPlaceholder": "What stayed with you from this book…",
  "field.page": "Page",
  "field.yearShort": "Year",
  "field.estimated": "Estimated",
  "field.paid": "Paid",
  "field.pages": "Page count",
  "field.publisher": "Publisher",
  "field.volume": "Volume",
  "field.format": "Format",
  "field.formatHint": "e.g. 13x20 cm",
  "field.category": "Category",
  "field.description": "Description",
  "field.rating": "Rating",
  "bookForm.duplicate": "You already have {titles} with this ISBN. You can save anyway.",
  "field.deadline": "Deadline",
  "challenge.finishTitle": "Finished it?",
  "selector.noBooks": "No books in the library.",
  "selector.nothingFor": "Nothing for \"{query}\".",

  /* -------------------------------------------------- covers */
  "cover.upload": "Upload an image",
  "cover.uploading": "Uploading…",
  "cover.replaced": "The cover has been replaced.",
  "cover.formatHintPick": "JPEG, PNG or WebP. Shrunk automatically on save.",
  "cover.formatHintUpload":
    "JPEG, PNG or WebP. Shrunk automatically before uploading.",
  "cover.tooBigToResize":
    "That image is {mb}MB and could not be shrunk automatically. Pick a smaller one.",

  /* -------------------------------------------------- deleting a book */
  "deleteBook.title": "Delete this book?",
  "deleteBook.confirm": "Delete for good",

  "book.unfavorite": "Remove from favourites",
  "deleteBook.body":
    "{title}{author} will be deleted for good, along with its reading history. This cannot be undone.",
  "deleteBook.byAuthor": " by {author}",
  "deleteBook.failed": "We could not delete it: {message}",

  /* -------------------------------------------------- empty and no-match states */
  "empty.library.title": "No books yet",
  "empty.library.body":
    "Add your first book by filling in the title. The rest — author, pages, genre, ISBN — is optional and can wait.",
  "noMatches.title": "No book matches",
  "noMatches.search":
    "The library is not empty — search with fewer words, or check whether the title is spelled differently from how you remember it.",
  "noMatches.filters":
    "The library is not empty — the filters are too narrow. Drop one and the books come back.",
  "noMatches.showAll": "Show every book",
  "filters.clear": "Clear the filters",

  /* -------------------------------------------------- Open Library search */
  "openLibrary.noResults": "Nothing found. Fill it in by hand below.",
  "openLibrary.unavailable":
    "Open Library is not answering. Fill the book in by hand below.",

  /* -------------------------------------------------- start reading */
  "startReading.title": "How many pages?",
  "startReading.why": "So I can show you how far in you are. You can skip this.",
  "startReading.without": "Without it, progress reads \"p. 143\", with no percentage.",
  "startReading.confirm": "Save and start",

  "startReading.movesTo": "{title} moves to {status}.",
  "startReading.pagesLabel": "Page count",
  "revoke.title": "Revoke access?",
  "revoke.body": "{client} will no longer be able to read or change the library. You can reconnect the assistant any time, with a fresh approval.",
  "revoke.failed": "We could not revoke access: {message}",

  /* -------------------------------------------------- budget */
  "budget.wishlistTotal": "What the lot would cost",
  "budget.spentTotal": "What I have spent",
  "budget.noBudgetYet":
    "Spent this month. Set yourself a budget to see what is left, too.",
  "budget.noBudget": "no budget",
  "budget.overspentTail": ". Nothing is blocked — you just know.",
  "budget.emptyChart":
    "No chart yet: no purchased book has a purchase date.",

  "budget.overspent": "You are {over} over your {budget} budget. Nothing is blocked — you just know.",
  "budget.remaining": "You have {remaining} left of {budget} this month.",

  /* -------------------------------------------------- reading chart */
  "chart.reading.title": "Books finished by month",
  "chart.reading.column": "Books finished",
  "chart.reading.empty":
    "No chart yet: no finished book has a finish date.",
  "chart.month": "Month",

  /* -------------------------------------------------- challenges */
  "challenge.edit": "Edit challenge",
  "challenge.new": "New challenge",
  "challenge.create": "Create a challenge",
  "challenge.namePlaceholder": "The summer challenge",
  "challenge.descriptionOptional": "Description (optional)",
  "challenge.noBooksYet": "No books yet.",
  "challenge.noBooksYetHint":
    "No books yet. Use \"Edit challenge\" to add one from your library.",
  "challenge.deleteTitle": "Delete this challenge for good?",
  "challenge.delete": "Delete challenge",
  "challenge.bookTally": {
    one: "{count} book",
    other: "{count} books",
  },
  "challenge.none": "No challenges yet",
  "challenge.noneBody":
    "A challenge is a set of books and a deadline — a shelf that fills up as you read.",
  "challenge.done": "Challenge complete.",
  "challenge.behind": "Rather less read than time elapsed.",
  "challenge.onTrack": "On or ahead of schedule.",
  "challenge.booksLabel": "Books",
  "challenge.finishedBooks": "books finished",
  "challenge.currentPage": "Current page",
  "challenge.timeElapsed": "Time elapsed",
  "challenge.deadlineOn": "by {date}",
  "challenge.changePage": "{progress} · change the page",
  "challenge.finishBook": "Mark as finished",
  "challenge.noteOptional": "Note (optional)",

  /* -------------------------------------------------- connectors (MCP) */
  "connectors.title": "Connected apps",
  "connectors.body":
    "AI assistants with access to your library over MCP. A revoked connector can be reconnected any time, with a fresh approval.",
  "connectors.loadFailed": "We could not load the list.",
  "connectors.revoke": "Revoke",
  "connectors.revoking": "Revoking…",
  "connectors.revokeConfirm": "Revoke access",
  "connectors.revokeBody":
    "will no longer be able to read or change the library. You can reconnect the assistant any time, with a fresh approval.",
  "connectors.lastUsed": "last used on {date}",
  "connectors.neverUsed": "never used",

  /* -------------------------------------------------- MCP consent */
  "consent.scope":
    "Full access to your library: it can read, add, change and delete books.",
  "consent.scopeOther": "Scope requested: {scope}",
  "consent.approve": "Approve",
  "consent.deny": "Refuse",
  "consent.connecting": "Connecting…",
  "consent.missing":
    "The connection request is missing. Start again from your AI assistant.",

  "consent.requestInvalid": "That request has expired or is no longer valid. Start the connection again from your assistant.",
  "consent.failed": "We could not connect: {message}",
  "pair.codeLabel": "The code on the Kobo",

  /* -------------------------------------------------- Kobo pairing */
  "pair.title": "Pair a Kobo",
  "pair.body":
    "Google refuses to sign you in directly in a Kobo's browser. Type in the code the Kobo is showing on its screen.",
  "pair.failed": "We could not approve that code. Try again.",
  "pair.done": "On the Kobo, press \"I approved it, continue\".",
  "pair.again": "Pair another device",

  /* -------------------------------------------------- admin */
  "admin.title": "Impersonate a user",
  "admin.body":
    "Take over another account's session, for debugging. You can return to your own account any time from the banner shown while impersonating.",
  "admin.searchFailed": "The search failed. Try again.",
  "admin.noAccounts": "No account found.",
  "admin.impersonate": "Impersonate",

  /* -------------------------------------------------- login */
  "login.tagline": "just as you remember it",
  "login.google": "Continue with Google",
  "login.privacy":
    "We do not ask you for a new password, and we read nothing from your Google account beyond your name, email and picture.",
  "login.failed": "Signing in did not work. Give it another go.",
  "login.throttled":
    "Too many sign-in attempts. Wait a minute and try again.",

  "login.headlineLead": "Your library,",
  "login.headline": "Your library, {tagline}.",
  "page.shelf.alphabetical": "Alphabetical",

  "origin.library": "the library",
  "origin.wishlist": "the wishlist",
  "origin.gallery": "the gallery",
  "origin.shelf": "the shelf",
  "origin.challenge": "the challenge",
  "origin.back": "Back to {where}",

  /* -------------------------------------------------- page furniture */
  "page.wishlist.blurb": "The books you want to read, kept apart from the ones you have.",
  "page.wishlist.empty":
    "Add a book with the status \"Wishlist\" and note the price you think it costs. The price is optional — a book can sit here without one.",
  "page.wishlist.totalNote":
    "The total is for the whole wishlist, not just the search results.",
  "page.gallery.blurb": "Your books by their covers — what a shelf looks like, not a table.",
  "page.shelf.blurb": "The books you own, as they would stand on a real shelf.",
  "page.shelf.empty":
    "This is where the books you own end up — bought, in progress, finished or abandoned. Wishlist books are not on your shelf yet.",
  "page.shelf.order": "Shelf order",
  "page.shelf.byPurchase": "By purchase date",
  "page.budget.blurb": "What you have spent on books, and what you meant to spend this month.",
  "page.stats.blurb": "How much you have read, and when — not how many books you own.",
  "page.profile.noDescription":
    "This book has no description yet. Write one from \"Edit\" — or ask Claude, if you have connected it to your library, to look up what the book is about and fill it in for you.",
  "page.selector.viewMode": "View mode",
  "page.selector.loadFailed": "We could not load the library.",

  /* -------------------------------------------------- what a screen is loading */
  "loading.library": "Loading the library…",
  "loading.wishlist": "Loading the wishlist…",
  "loading.gallery": "Loading the gallery…",
  "loading.shelf": "Loading the shelf…",
  "loading.budget": "Loading the budget…",
  "loading.chart": "Loading the chart…",
  "loading.stats": "Loading the statistics…",
  "loading.challenge": "Loading the challenge…",
  "loading.book": "Loading the book…",

  /* -------------------------------------------------- what failed to load */
  "what.library": "the library",
  "what.wishlist": "the wishlist",
  "what.gallery": "the gallery",
  "what.shelf": "the shelf",
  "what.budget": "the budget",
  "what.chart": "the chart",
  "what.stats": "the statistics",
  "what.challenge": "the challenge",
  "what.book": "the book",

  /* -------------------------------------------------- api */
  "api.sessionExpired": "Your session has expired, or there is none",

  "nav.menu": "Menu",
  "home.readingNow": "Reading now",
  "field.pagesShort": "Pages",
  "field.descriptionPlaceholder": "What the book is about…",
  "cover.preview": "Cover preview",
  "filters.allCategories": "All categories",
  "startReading.skip": "Skip",
  "budget.monthly": "Monthly budget",
  "chart.spend.title": "Spending by month",
  "profile.details": "Details",
  "connectors.none": "No assistant is connected right now.",
  "pair.codeApproved": "Code approved",
  "pair.code": "Code",
  "page.shelf.emptyTitle": "The shelf is empty",
  "page.wishlist.emptyTitle": "The wishlist is empty",

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
