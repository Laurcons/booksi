# Bookcsi — Arhitectură

Documentul descrie *cum* se construiește ce e definit în [USER_STORIES.md](USER_STORIES.md),
pe baza deciziilor din [DECISIONS.md](DECISIONS.md).

---

## Stack

| Strat | Alegere | Note |
|---|---|---|
| Bază de date | MariaDB 11 | charset `utf8mb4`, collation `utf8mb4_unicode_ci` — obligatoriu pentru diacritice |
| ORM | Prisma, `provider = "mysql"` | conectorul MySQL acoperă MariaDB; `prisma migrate` complet funcțional |
| Backend | NestJS | REST, nu GraphQL — modelul e prea mic ca să justifice GraphQL |
| Autentificare | Google OAuth 2.0 | `@nestjs/passport` + `passport-google-oauth20` |
| Sesiune | JWT în cookie `httpOnly` | vezi §D20 |
| Frontend | Vite + React + TypeScript | |
| Rutare | React Router | rute protejate de un `<RequireAuth>` wrapper |
| Server state | TanStack Query | cache-ul de listă/detaliu; invalidare la mutații |
| Formulare | react-hook-form + zod | rezolver zod, cu scheme partajate cu backendul |
| Grafice | Recharts | necesar abia din Sprint 6 |
| Stilizare | Tailwind CSS | tokenurile de temă din [DESIGN.md](DESIGN.md) intră în `theme.extend`, nu ca valori inline |
| Fonturi | Playfair Display + Inter | self-hosted, nu Google Fonts CDN |

Nu există fallback Google Books. Open Library e singura sursă externă.

---

## Structură de monorepo

```
bookcsi/
├── backend/                  # NestJS
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/       # versionat în git
│   └── src/
│       ├── auth/             # Sprint 0
│       ├── books/            # Sprint 1-2
│       ├── covers/           # Sprint 4
│       ├── openlibrary/      # Sprint 4
│       ├── budget/           # Sprint 6 (doar citiri, agregări)
│       ├── settings/         # Sprint 6
│       └── stats/            # Sprint 7-8 (doar citiri, agregări)
├── frontend/                 # Vite + React
│   ├── public/coperti/       # coperți descărcate o dată, nu la randare
│   └── src/
│       ├── components/
│       ├── data/
│       ├── api/              # hooks TanStack Query
│       └── lib/
├── kobo-frontend/            # Express + HTML randat pe server, zero JS de client (§D37)
│   └── src/
│       ├── config/
│       ├── lib/              # html.ts (templating), ui-choice.ts (regula de rutare)
│       └── routes/
├── shared/                   # scheme zod + tipuri, importate de toate părțile
├── docker/
│   └── kobo-routing.conf     # nginx: alege între cele două frontend-uri, după User-Agent
├── docs/
└── local/                    # credențiale — NU se commituie
```

Gestionar de pachete: **npm workspaces**, declarate în `package.json`-ul rădăcină.

Cele două frontend-uri stau pe **aceeași origine**, iar proxy-ul alege între ele per cerere
(§D37). Nu e o preferință de stil: cookie-ul de sesiune e host-only, deci un al doilea nume de
gazdă n-ar primi nicio sesiune. `kobo-frontend/` nu conține logică de business — randează, iar
ce trebuie calculat vine din API sau din `shared/`.

`shared/` există ca să nu apară două definiții ale aceluiași DTO. Schema zod scrisă o dată e
folosită de Nest pentru validare (`ZodValidationPipe`) și de react-hook-form pe frontend.

**Limbă:** tot codul e în engleză — identificatori, câmpuri de bază de date, enum-uri, nume de
fișiere. Româna apare exclusiv în șirurile afișate utilizatorului, prin mape de traducere
(`STATUS_LABEL`, `GENRE_LABEL`). Singura excepție tolerată e `public/coperti/`, o cale de
fișiere din mock.

---

## Schema Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  googleId  String   @unique
  email     String   @unique
  name      String?
  avatarUrl String?  @db.Text
  createdAt DateTime @default(now())

  // Incrementat la delogare; token-ul rămas în urmă e refuzat — vezi D23.
  tokenVersion Int @default(0)

  books    Book[]
  settings Settings?
}

enum Status {
  WISHLIST
  PURCHASED
  READING
  FINISHED
  ABANDONED
}

// §D39 — 29 topic categories, replacing the original 17-value literary-genre
// list. Still `genre`/`Genre` in code; see §D39 for why the identifier didn't
// move with the UI rename to "categorie".
enum Genre {
  AUDIOBOOKS
  CULINARY
  ART_ARCHITECTURE
  ENCYCLOPEDIAS
  BIOGRAPHIES
  LINGUISTICS_DICTIONARIES
  ROMANIAN_MAGAZINES
  FOREIGN_LANGUAGES
  POETRY_THEATRE
  FICTION
  COMICS
  TRAVEL_GUIDES
  HISTORY
  RELIGION
  PHILOSOPHY
  PSYCHOLOGY
  SOCIAL_SCIENCES_POLITICS
  MARKETING_COMMUNICATION
  BUSINESS_ECONOMY
  LAW
  MEDICINE
  EXACT_SCIENCES_MATH
  NATURE_ENVIRONMENT
  TECHNOLOGY
  COMPUTERS_INTERNET
  HEALTH_SELF_DEVELOPMENT
  LIFESTYLE_SPORT_LEISURE
  ROMANIA
  EDUCATIONAL_SOFTWARE
}

model Book {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // identity (user-input or Open Library)
  title           String
  author          String?
  isbn            String? // NOT unique — see D13
  totalPages      Int?    // frequently absent — see D4
  genre           Genre?
  publisher       String?
  publicationYear Int?
  volume          Int?
  format          String? // free-text dimensions, e.g. "13x20 cm"
  olEditionKey    String?
  description     String? @db.Text // §D40 — prose; scris de utilizator sau de Claude prin MCP

  // state (user-input)
  status    Status  @default(WISHLIST)
  favorite  Boolean @default(false)
  pagesRead Int     @default(0)
  rating    Int? // 1-5

  // money
  estimatedPrice Decimal? @db.Decimal(10, 2)
  paidPrice      Decimal? @db.Decimal(10, 2)

  // dates (system-generated, user-overridable — see D1)
  purchasedOn DateTime? @db.Date
  startedOn   DateTime? @db.Date
  finishedOn  DateTime? @db.Date

  // system
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  cover Cover?

  @@index([userId, status])
  @@index([userId, finishedOn])
  @@index([userId, purchasedOn])
}

enum CoverSource {
  OPEN_LIBRARY
  UPLOAD
}

model Cover {
  bookId String @id
  book   Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)

  data     Bytes       @db.LongBlob
  mimeType String
  source   CoverSource

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt // versiunea din `?v=` — vezi D26
}

model Settings {
  userId String @id
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  monthlyBudget Decimal? @db.Decimal(10, 2)
  yearlyBudget  Decimal? @db.Decimal(10, 2)
  currency      String   @default("RON")
}
```

Note:

- **`Decimal`, nu `Float`, pentru bani.** Un `Float` acumulează erori de rotunjire în agregările
  de buget din Sprint 6.
- **`Cover` e tabel separat.** Prisma nu are lazy loading: pe rândul `Book`, blob-ul ar fi citit
  la fiecare listare a bibliotecii. Vezi §D18.
- **`manuallyEditedFields` e `Json`.** MariaDB implementează `JSON` ca `LONGTEXT` cu constrângere,
  nu ca tip nativ ca MySQL 8 — funcțional prin Prisma, dar fără interogări pe conținut. Nu avem
  nevoie de așa ceva: câmpul se citește întreg în aplicație.
- **`onDelete: Cascade` peste tot.** Ștergerea unui cont șterge biblioteca; ștergerea unei cărți
  (S1.3) șterge coperta.

---

## Autentificare (Sprint 0)

Flux:

```
web  ──GET /auth/google──►  api  ──redirect──►  Google
                                                  │
                          api ◄──callback + cod───┘
                           │
                           ├─ upsert Utilizator pe googleId
                           ├─ semnează JWT { sub: userId }
                           ├─ Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax
                           └─ redirect ──► web
```

- `GET /auth/google` — inițiază flow-ul.
- `GET /auth/google/callback` — creează/regăsește utilizatorul, setează cookie-ul, redirect.
- `GET /auth/me` — utilizatorul curent, sau 401. Frontendul îl apelează la boot ca să decidă
  între login și aplicație.
- `POST /auth/logout` — șterge cookie-ul.

Un `JwtAuthGuard` global protejează tot, cu `@Public()` doar pe rutele de auth.

**Izolarea datelor (S0.3)** nu se lasă în grija fiecărui controller: `userId` se ia din request,
niciodată din body sau din query. Fiecare acces la o carte trece prin
`where: { id, userId }` — un ID din altă bibliotecă produce „not found", deci returnăm 404,
nu 403, ca să nu confirmăm existența.

**CORS în dev:** frontendul e pe `:5173`, API-ul pe `:3000` — origini diferite. Backendul are
nevoie de `credentials: true` și origine explicită (nu `*`), iar `fetch` din frontend de
`credentials: "include"`.

---

## Open Library (Sprint 4)

**Toate apelurile pleacă din backend.** Frontendul nu atinge niciodată `openlibrary.org` direct.
Nu e o preferință stilistică: criteriile din Sprint 4 cer ca imaginea să fie descărcată și
stocată, iar D18 o pune în baza de date — ambele se pot face doar server-side.

| Rută internă | Ce face |
|---|---|
| `GET /openlibrary/search?q=` | proxy peste Search API; cel mult 10 *works* normalizate |
| `GET /openlibrary/editions/:key` | ediția aleasă, ca set de câmpuri de formular (§D7) |
| `GET /openlibrary/isbn/:isbn` | același set de câmpuri, ajuns din ISBN |
| `GET /openlibrary/covers/:key` | proxy peste `covers.openlibrary.org` — miniaturile din lista de rezultate |
| `POST /books` | la creare, dacă vine cu `olEditionKey`, descarcă coperta și o salvează |
| `PUT /books/:id/cover` | upload manual: body brut `image/*`, max 5MB (S4.3) |
| `GET /covers/:bookId` | servește blob-ul, cu `Cache-Control: max-age=31536000, immutable` |

Căutarea și lookup-ul după ISBN folosesc două API-uri diferite ale Open Library, din motive
diferite. Search API dă *works* și e singurul care caută după text liber. Completarea folosește
**Books API cu `jscmd=data`** (`/api/books?bibkeys=OLID:…`), fiindcă întoarce autorii **cu
nume** într-o singură cerere; documentul de ediție (`/books/OL…M.json`) i-ar da doar prin cheie,
adică încă un round-trip per autor.

- **Debounce de 300ms** se aplică în frontend, înainte de a lovi propriul backend. Rutele de
  proxy au în plus o limită proprie de 10 cereri/secundă.
- **Nicio randare nu declanșează un apel extern.** După adăugare, cartea se afișează identic
  și dacă Open Library e complet indisponibil. Excepția evidentă e lista de rezultate a unei
  căutări, care e live prin definiție — dar și ea trece prin proxy-ul nostru.
- **Works vs. editions (§D7):** Search API returnează *works*; la selecție, backendul rezolvă
  `cover_edition_key` pentru copertă, ISBN și număr de pagini.
- **Coperta se descarcă la `POST /books`**, nu la selecție: o carte căutată și abandonată în
  formular nu trebuie să lase un blob în bază. `?default=false` pe URL-ul de copertă e ce
  transformă „ediția n-are copertă" într-un 404 — fără el se primește un dreptunghi gri cu 200,
  care ar ajunge stocat ca și cum ar fi o copertă reală.
- **Formatul imaginilor se citește din primii octeți**, niciodată din `Content-Type`: antetul e
  al clientului, iar imaginea ajunge servită înapoi de pe originea noastră.
- **Degradare grațioasă:** orice eroare externă întoarce un răspuns care lasă formularul manual
  complet funcțional — 503 dacă Open Library nu răspunde, 502 dacă răspunde cu ceva de necitit.
  Open Library indisponibil nu blochează adăugarea unei cărți: cartea se creează, doar fără
  copertă.

---

## Galeria (Sprint 5)

Grila e o rută proprie în frontend (`/gallery`, §D28), dar **nicio rută nouă în API**: e
aceeași listare ca tabelul, cu filtrele din S5.3 aplicate în SQL (§D29).

| Parametru | Formă | Serveste |
|---|---|---|
| `sort` | `title \| author \| status \| createdAt`, implicit `createdAt` | S1.2 |
| `order` | `asc \| desc`, implicit `desc` | S1.2 |
| `status` | unul sau mai mulți, ca parametru repetat: `?status=READING&status=FINISHED` | S3.1 (unul), S5.3 (mai mulți) |
| `genre` | o singură valoare — o carte are o singură categorie (§D17, §D39) | S5.3 |
| `favorite` | `true` / `false` | S5.3 |

Absent = fără filtru, pentru toate trei. Combinarea lor e un `AND`: „SF" + „favorite" +
„status ∈ {Terminat}" e o singură clauză `where`.

Două capcane, ambele în parsarea unui query string:

- **Parametrul repetat ajunge array de la Express** (`qs`), iar o singură apariție ajunge
  string. Schema acceptă ambele forme și normalizează la array, ca `?status=WISHLIST` să
  rămână valid cuvânt cu cuvânt — altfel S3.1 s-ar strica la o schimbare care nu e a lui.
- **Booleanul vine ca text.** `z.coerce.boolean("false")` e `true`, fiindcă șirul e nevid;
  `favorite` se parsează explicit din `"true" | "false"`.

`favorite` devine în același sprint câmp scriptibil pe `POST /books` și `PATCH /books/:id`
(§D30), fără rută dedicată.

---

## Fișa cărții (Sprint 9)

`/books/:id` e singura rută cu parametru din frontend, și nu are o rută de API a ei: citește
`GET /books/:id`, care exista de la Sprint 1. Ce e nou pe server e o singură coloană,
`description` (§D40) — restul fișei desenează câmpuri care erau deja acolo.

**Originea navigării stă în `history.state`**, nu în URL și nu într-un store. Fiecare ecran care
deschide o carte scrie acolo `{ to, label }` prin `useOpenBook` (`frontend/src/lib/book-origin.ts`),
iar fișa citește cu `useBookOrigin`. `history.state` supraviețuiește unui reload, ceea ce e exact
proprietatea de care butonul „înapoi" are nevoie; în schimb nu supraviețuiește unui link rece, și
atunci se cade pe ecranul cărui îi aparține cartea. Starea e validată la citire (cale internă,
etichetă nevidă) — vezi §D41.

**MCP nu capătă nicio unealtă nouă.** `description` intră în `createBookSchema`/`updateBookSchema`,
deci `add_book` și `update_book` o scriu fără cod nou; `get_book` o întoarce, iar rândul subțire
al lui `search_library` o omite deliberat (§D40, MCP.md §8).

## Erori (§D27)

Un singur criteriu: *poate utilizatorul face ceva?*

| | Aruncat ca | Răspuns | Client |
|---|---|---|---|
| Poate | `AppError(status, code, mesaj)` | `{ statusCode, code, message }` | afișează `message` verbatim |
| Nu poate | `Error` obișnuit | `{ statusCode: 500, message: generic }`, **fără cod** | afișează propriile cuvinte |

`AppExceptionFilter` e global și rescrie orice 5xx fără cod, deci un mesaj intern nu poate
ajunge pe ecran nici din greșeală. Codurile sunt în `shared/src/errors.ts` — ambele capete
citesc aceeași listă, iar unul necunoscut e ignorat de client.

Statusul nu decide nimic pe frontend: `errorMessage(error, fallback)` se uită la cod. Un 503
de la Open Library **își păstrează mesajul**, fiindcă „scrie cartea manual" e exact ce poate
face utilizatorul.

---

## Agregările (Sprinturile 6–8)

Toate valorile derivate din DECISIONS.md se calculează **în SQL, la cerere**, nu se stochează și
nu se recalculează în JavaScript peste toată biblioteca.

| Endpoint | Servește |
|---|---|
| `GET /stats/overview` | S7.1 și dashboard-ul S8.1 — aceleași cifre, aceeași sursă |
| `GET /stats/by-month` | S7.2, grupare pe `finishedOn` |
| `GET /budget/summary` | S6.1 (`total`) **și** S6.3 (`month`), într-un singur răspuns |
| `GET /budget/by-month` | S6.2, grupare pe `purchasedOn`, serie densă |
| `GET /settings` · `PUT /settings` | S6.3 — bugetul lunar, singurul câmp (§D31) |

Regula de agregare a paginilor (S7.1) trăiește într-un singur loc, în modulul `stats`.
Dashboard-ul consumă același endpoint ca pagina de statistici — altfel cele două ecrane ajung
inevitabil să afișeze cifre diferite.

Cărțile fără dată sunt excluse din grafice, dar numărate în răspuns, ca frontendul să poată
afișa avertismentul cerut de S6.2 și S7.2. Forma diferă însă între cele două, fiindcă
întrebarea diferă: la buget e număr **și** sumă (`UndatedSpend`) — „câte cărți nu-ți arată
graficul, și ce bani înseamnă" — iar la statistici e doar numărul cărților terminate fără
`finishedOn`. O sumă de bani sub un grafic de cărți citite ar răspunde la altă întrebare decât
cea pusă.

Note despre bugetul din Sprint 6:

- **Doar `paidPrice`.** Estimarea din wishlist (§D6) nu apare în nicio clauză de aici.
- **`/budget/summary` duce amândouă story-urile**, fiindcă sunt același ecran: două cereri
  separate pot cădea de o parte și de alta a miezului nopții dintre 31 și 1 și ar afișa luni
  diferite (§D31).
- **`remaining` devine negativ** la depășire; nu se oprește la zero, și nu se reportează (§D9).
- **Gruparea pe lună e o interogare raw**, fiindcă `groupBy` din Prisma grupează după o
  coloană, iar cheia aici e o *funcție* de coloană (`DATE_FORMAT`). `userId` intră ca parametru
  legat prin template tag, niciodată concatenat în SQL (S0.3).
- **Seria e densă**: lunile goale apar cu `0` de la prima cumpărare datată până la luna
  curentă; o bibliotecă fără cumpărări datate dă o listă goală.

---

## Mediu local

`docker-compose.yml` pentru MariaDB; restul rulează pe gazdă.

Variabile de mediu (`apps/api/.env`, negitat):

```
DATABASE_URL="mysql://bookcsi:parola@localhost:3306/bookcsi"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
JWT_SECRET=
WEB_ORIGIN="http://localhost:5173"
```

Baza se creează cu `utf8mb4` explicit — implicitul MariaDB variază între versiuni și distribuții,
iar un `latin1` nimerit din greșeală strică diacriticele din titluri abia după ce ai date reale.

**`.gitignore` de la primul commit:** `local/`, `.env`, `node_modules/`, `dist/`.
Directorul `local/` conține deja credențiale Trello în clar.
