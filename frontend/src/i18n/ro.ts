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

  /* -------------------------------------------------- common */
  "common.close": "Închide",
  "common.delete": "Șterge",
  "common.deleting": "Se șterge…",
  "common.edit": "Editează",
  "common.add": "Adaugă",
  "common.create": "Creează",
  "common.creating": "Se creează…",
  "common.approve": "Aprobă",
  "common.approving": "Se aprobă…",
  "common.searching": "Se caută…",
  "common.loading": "Se încarcă…",

  /* -------------------------------------------------- a book's own fields */
  "book.cover": "Copertă",
  "book.coverOf": "Coperta cărții {title}",
  "book.publicationYear": "Anul apariției",
  "book.totalPages": "Număr de pagini",
  "book.price": "Preț",
  "book.estimatedPrice": "Preț estimat",
  "book.paidPrice": "Preț plătit",
  "book.purchasedOn": "Cumpărată",
  "book.startedOn": "Începută",
  "book.finishedOn": "Terminată",
  "book.addedOn": "Adăugată",
  "book.favorite": "Favorită",
  "book.markFavorite": "Marchează ca favorită",
  "book.noRating": "fără rating",

  /* -------------------------------------------------- the add/edit form */
  "bookForm.editTitle": "Editează cartea",
  "bookForm.addTitle": "Carte nouă",
  "bookForm.fromOpenLibrary": "Completat din Open Library. Corectează orice câmp.",
  "bookForm.olUnavailable":
    "Open Library nu răspunde acum. Completează câmpurile manual.",
  "bookForm.searchingIsbn": "Se caută ISBN-ul în Open Library…",
  "bookForm.scanBarcode": "Scanează codul de bare",
  "bookForm.noCategory": "— fără categorie —",

  /* the four tabs */
  "bookForm.tab.book": "Carte",
  "bookForm.tab.description": "Descriere",
  "bookForm.tab.reading": "Lectură",
  "bookForm.tab.verdict": "Verdict",
  "bookForm.tabChanged": "are modificări nesalvate",
  "bookForm.tabInvalid": "are un câmp de corectat",

  /* what a locked field says on hover */
  "bookForm.lockedProgress": "Se deschide când cartea e la tine",
  "bookForm.lockedStarted": "Se deschide după ce cartea ajunge la tine",
  "bookForm.lockedFinished": "Se deschide după ce începi cartea",
  "bookForm.lockedPaid": "Se deschide după cumpărare",
  "bookForm.lockedRating": "Stelele se dau la „Terminat” sau „Abandonat”",

  "bookForm.changeCover": "Schimbă coperta",
  "bookForm.markFinished": "Am terminat-o",
  "bookForm.today": "Azi",
  "bookForm.charCount": "{count} / {max}",

  /* -------------------------------------------------- the table */
  "table.actions": "Acțiuni",
  "table.sortBy": "Sortează după",
  "table.asc": "Crescător",
  "table.desc": "Descrescător",

  /* -------------------------------------------------- the barcode scanner */
  "scan.instruction": "Arată codul de bare de pe spatele cărții.",
  "scan.starting": "Se pornește camera…",
  "scan.videoLabel": "Imagine de la cameră",
  "scan.unsupported":
    "Browserul acesta nu dă acces la cameră. Scrie ISBN-ul de mână.",
  "scan.needsHttps": "Camera funcționează doar pe HTTPS. Scrie ISBN-ul de mână.",
  "scan.failed": "Camera n-a putut porni. Scrie ISBN-ul de mână.",
  "scan.denied":
    "N-am primit acces la cameră. Poți permite accesul din setările browserului, sau scrie ISBN-ul de mână.",
  "scan.noCamera": "Nu găsesc nicio cameră. Scrie ISBN-ul de mână.",

  /* -------------------------------------------------- search boxes */
  "search.library": "Caută în bibliotecă",
  "search.books": "Caută cărți",
  "search.byBookFields": "Caută după titlu, autor, editură, ISBN…",
  "search.wishlist": "Caută în wishlist…",
  "search.byEmail": "Caută după email",
  "search.openLibrary": "Caută în Open Library",
  "search.noCategoryMatches": "Nicio categorie nu se potrivește.",
  "category.searchPlaceholder": "Caută categorii…",
  "category.remove": "Elimină {label}",

  "field.title": "Titlu",
  "field.author": "Autor",
  "field.status": "Status",
  "field.pages": "Nr. de pagini",
  "field.publisher": "Editura",
  "field.volume": "Volum",
  "field.format": "Format",
  "field.formatHint": "ex. 13x20 cm",
  "field.category": "Categorie",
  "field.categories": "Categorii",
  "field.description": "Descriere",
  "field.review": "Recenzie",
  "field.reviewPlaceholder": "Ce ți-a rămas din cartea asta…",
  "field.rating": "Rating",
  "field.page": "Pagina",
  "field.yearShort": "An",
  "field.estimated": "Estimat",
  "field.paid": "Plătit",
  "bookForm.duplicate": "Ai deja {titles} cu acest ISBN. Poți salva oricum.",
  "field.deadline": "Termen",
  "challenge.finishTitle": "Ai terminat-o?",
  "selector.noBooks": "Nicio carte în bibliotecă.",
  "selector.nothingFor": "Nimic pentru „{query}”.",

  /* -------------------------------------------------- covers */
  "cover.upload": "Încarcă o imagine",
  "cover.uploading": "Se încarcă…",
  "cover.replaced": "Coperta a fost înlocuită.",
  "cover.formatHintPick": "JPEG, PNG sau WebP. Se micșorează automat la salvare.",
  "cover.formatHintUpload":
    "JPEG, PNG sau WebP. Se micșorează automat înainte de încărcare.",
  "cover.tooBigToResize":
    "Imaginea are {mb}MB și n-a putut fi micșorată automat. Alege una mai mică.",

  /* -------------------------------------------------- deleting a book */
  "deleteBook.title": "Ștergi cartea?",
  "deleteBook.confirm": "Șterge definitiv",

  "book.unfavorite": "Scoate de la favorite",
  "deleteBook.body":
    "{title}{author} se șterge definitiv, împreună cu datele de lectură. Nu se poate anula.",
  "deleteBook.byAuthor": " de {author}",
  "deleteBook.failed": "Nu am putut șterge: {message}",

  /* -------------------------------------------------- empty and no-match states */
  "empty.library.title": "Încă n-ai nicio carte",
  "empty.library.body":
    "Adaugă prima carte completând titlul. Restul câmpurilor — autor, pagini, gen, ISBN — sunt opționale și le poți completa oricând.",
  "noMatches.title": "Nicio carte nu se potrivește",
  "noMatches.search":
    "Biblioteca nu e goală — caută cu mai puține cuvinte, sau verifică dacă titlul e scris altfel decât ți-l amintești.",
  "noMatches.filters":
    "Biblioteca nu e goală — filtrele sunt prea înguste. Mai scoate unul și cărțile se întorc.",
  "noMatches.showAll": "Arată toate cărțile",
  "filters.clear": "Șterge filtrele",

  /* -------------------------------------------------- Open Library search */
  "openLibrary.noResults": "Niciun rezultat. Completează manual mai jos.",
  "openLibrary.unavailable":
    "Open Library nu răspunde acum. Completează cartea manual mai jos.",

  /* -------------------------------------------------- start reading */
  "startReading.title": "Câte pagini are?",
  "startReading.why": "Ca să-ți pot arăta cât ai citit din ea. Poți sări peste.",
  "startReading.without": "Fără el, progresul se arată ca „pag. 143”, fără procent.",
  "startReading.confirm": "Salvează și începe",

  "startReading.movesTo": "{title} trece la {status}.",
  "startReading.pagesLabel": "Nr. de pagini",
  "revoke.title": "Revoci accesul?",
  "revoke.body": "{client} nu va mai putea citi sau modifica biblioteca. Poți reconecta asistentul oricând, dintr-o nouă aprobare.",
  "revoke.failed": "Nu am putut revoca accesul: {message}",

  /* -------------------------------------------------- budget */
  "budget.wishlistTotal": "Cât m-ar costa tot",
  "budget.spentTotal": "Cât am cheltuit",
  "budget.noBudgetYet":
    "Cheltuit luna asta. Pune-ți un buget ca să vezi și cât mai ai.",
  "budget.noBudget": "fără buget",
  "budget.overspentTail": ". Nimic nu se blochează — doar știi.",
  "budget.emptyChart":
    "Niciun grafic încă: nicio carte cumpărată n-are dată de cumpărare.",

  "budget.overspent": "Ai depășit bugetul de {budget} cu {over}. Nimic nu se blochează — doar știi.",
  "budget.remaining": "Ți-au mai rămas {remaining} din {budget} luna asta.",

  /* -------------------------------------------------- reading chart */
  "chart.reading.title": "Cărți terminate pe luni",
  "chart.reading.column": "Cărți terminate",
  "chart.reading.empty":
    "Niciun grafic încă: nicio carte terminată n-are dată de terminare.",
  "chart.month": "Luna",

  /* -------------------------------------------------- challenges */
  "challenge.edit": "Editează provocarea",
  "challenge.new": "Provocare nouă",
  "challenge.create": "Creează o provocare",
  "challenge.namePlaceholder": "Provocarea de vară",
  "challenge.descriptionOptional": "Descriere (opțional)",
  "challenge.noBooksYet": "Nicio carte încă.",
  "challenge.noBooksYetHint":
    "Nicio carte încă. „Editează provocarea” ca să adaugi una din bibliotecă.",
  "challenge.deleteTitle": "Ștergi definitiv provocarea?",
  "challenge.delete": "Șterge provocarea",
  "challenge.bookTally": {
    one: "o carte",
    few: "{count} cărți",
    other: "{count} de cărți",
  },
  "challenge.none": "Nicio provocare încă",
  "challenge.noneBody":
    "O provocare e un set de cărți și un termen — un raft care se umple pe măsură ce citești.",
  "challenge.done": "Provocare încheiată.",
  "challenge.behind": "Ceva mai puțin citit decât timpul scurs.",
  "challenge.onTrack": "Conform sau înaintea termenului.",
  "challenge.booksLabel": "Cărți",
  "challenge.finishedBooks": "cărți terminate",
  "challenge.currentPage": "Pagina curentă",
  "challenge.timeElapsed": "Timp scurs",
  "challenge.deadlineOn": "până pe {date}",
  "challenge.changePage": "{progress} · schimbă pagina",
  "challenge.finishBook": "Marchează terminată",
  "challenge.noteOptional": "Notă (opțional)",

  /* -------------------------------------------------- connectors (MCP) */
  "connectors.title": "Aplicații conectate",
  "connectors.body":
    "Asistenții AI cu acces la biblioteca ta prin MCP. Un conector revocat poate fi reconectat oricând, printr-o nouă aprobare.",
  "connectors.loadFailed": "Nu am putut încărca lista.",
  "connectors.revoke": "Revocă",
  "connectors.revoking": "Se revocă…",
  "connectors.revokeConfirm": "Revocă accesul",
  "connectors.revokeBody":
    "nu va mai putea citi sau modifica biblioteca. Poți reconecta asistentul oricând, dintr-o nouă aprobare.",
  "connectors.lastUsed": "folosit ultima dată pe {date}",
  "connectors.neverUsed": "nefolosit încă",

  /* -------------------------------------------------- MCP consent */
  "consent.scope":
    "Acces complet la biblioteca ta: poate citi, adăuga, modifica și șterge cărți.",
  "consent.scopeOther": "Domeniul cerut: {scope}",
  "consent.approve": "Aprobă",
  "consent.deny": "Refuză",
  "consent.connecting": "Se conectează…",
  "consent.missing":
    "Lipsește cererea de conectare. Reia procesul din asistentul AI.",

  "consent.requestInvalid": "Cererea a expirat sau nu mai e validă. Reia conectarea din asistent.",
  "consent.failed": "Nu am putut conecta: {message}",
  "pair.codeLabel": "Codul de pe Kobo",

  /* -------------------------------------------------- Kobo pairing */
  "pair.title": "Împerechere Kobo",
  "pair.body":
    "Google refuză autentificarea directă în browserul unui Kobo. Tastează aici codul pe care Kobo-ul îl arată pe ecran.",
  "pair.failed": "Nu am putut aproba codul. Încearcă din nou.",
  "pair.done": "Pe Kobo, apasă „Am aprobat, continuă”.",
  "pair.again": "Împerechează alt dispozitiv",

  /* -------------------------------------------------- admin */
  "admin.title": "Impersonează utilizator",
  "admin.body":
    "Preia sesiunea unui alt cont, pentru depanare. Te poți întoarce oricând la contul tău din bannerul afișat cât timp impersonezi.",
  "admin.searchFailed": "Căutarea a eșuat. Încearcă din nou.",
  "admin.noAccounts": "Niciun cont găsit.",
  "admin.impersonate": "Impersonează",

  /* -------------------------------------------------- login */
  "login.tagline": "așa cum o ții minte",
  "login.google": "Continuă cu Google",
  "login.privacy":
    "Nu-ți cerem o parolă nouă și nu citim nimic din contul tău Google în afară de nume, e-mail și poză.",
  "login.failed": "Autentificarea nu a reușit. Mai încearcă o dată.",
  "login.throttled":
    "Prea multe încercări de autentificare. Așteaptă un minut și încearcă din nou.",

  "login.headlineLead": "Biblioteca ta,",
  "login.headline": "Biblioteca ta, {tagline}.",
  "page.shelf.alphabetical": "Alfabetic",

  "origin.library": "bibliotecă",
  "origin.wishlist": "wishlist",
  "origin.gallery": "galerie",
  "origin.shelf": "raft",
  "origin.challenge": "provocare",
  "origin.back": "Înapoi la {where}",

  /* -------------------------------------------------- page furniture */
  "page.wishlist.blurb": "Cărțile pe care vrei să le citești, separat de ce ai deja.",
  "page.wishlist.empty":
    "Adaugă o carte cu statusul „Wishlist” și trece-i prețul pe care crezi că-l are. Prețul e opțional — cartea poate sta aici și fără el.",
  "page.wishlist.totalNote":
    "Totalul e pentru tot wishlist-ul, nu doar pentru rezultatele căutării.",
  "page.gallery.blurb": "Cărțile tale după copertă — cum arată un raft, nu un tabel.",
  "page.shelf.blurb": "Cărțile pe care le ai, așa cum ar sta pe un raft adevărat.",
  "page.shelf.empty":
    "Aici ajung cărțile pe care le ai — cumpărate, în curs, terminate sau abandonate. Cele din wishlist încă nu-ți stau pe raft.",
  "page.shelf.order": "Ordinea cărților pe raft",
  "page.shelf.byPurchase": "După cumpărare",
  "page.budget.blurb": "Cât ai dat pe cărți, și cât ți-ai propus să dai luna asta.",
  "page.stats.blurb": "Cât ai citit, și când — nu câte cărți ai.",
  "page.profile.noDescription":
    "Cartea n-are încă o descriere. Scrie una din „Editează” — sau cere-i lui Claude, dacă l-ai conectat la bibliotecă, să caute despre ce e cartea și să ți-o completeze.",
  "page.selector.viewMode": "Mod de afișare",
  "page.selector.loadFailed": "Nu am putut încărca biblioteca.",

  /* -------------------------------------------------- what a screen is loading */
  "loading.library": "Se încarcă biblioteca…",
  "loading.wishlist": "Se încarcă wishlist-ul…",
  "loading.gallery": "Se încarcă galeria…",
  "loading.shelf": "Se încarcă raftul…",
  "loading.budget": "Se încarcă bugetul…",
  "loading.chart": "Se încarcă graficul…",
  "loading.stats": "Se încarcă statisticile…",
  "loading.challenge": "Se încarcă provocarea…",
  "loading.book": "Se încarcă cartea…",

  /* -------------------------------------------------- what failed to load */
  "what.library": "biblioteca",
  "what.wishlist": "wishlist-ul",
  "what.gallery": "galeria",
  "what.shelf": "raftul",
  "what.budget": "bugetul",
  "what.chart": "graficul",
  "what.stats": "statisticile",
  "what.challenge": "provocarea",
  "what.book": "cartea",

  /* -------------------------------------------------- api */
  "api.sessionExpired": "Sesiune expirată sau inexistentă",

  "nav.menu": "Meniu",
  "home.readingNow": "Citesc acum",
  "field.pagesShort": "Pagini",
  "field.descriptionPlaceholder": "Despre ce e cartea…",
  "cover.preview": "Previzualizarea copertei",
  "filters.allCategories": "Toate categoriile",
  "startReading.skip": "Sari peste",
  "budget.monthly": "Buget lunar",
  "chart.spend.title": "Cheltuieli pe luni",
  "profile.details": "Detalii",
  "connectors.none": "Niciun asistent conectat momentan.",
  "pair.codeApproved": "Cod aprobat",
  "pair.code": "Cod",
  "page.shelf.emptyTitle": "Raftul e gol",
  "page.wishlist.emptyTitle": "Wishlist-ul e gol",

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
