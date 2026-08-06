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
│       ├── settings/         # Sprint 6
│       └── stats/            # Sprint 6-8 (doar citiri, agregări)
├── frontend/                 # Vite + React
│   ├── public/coperti/       # coperți descărcate o dată, nu la randare
│   └── src/
│       ├── components/
│       ├── data/
│       ├── api/              # hooks TanStack Query
│       └── lib/
├── shared/                   # scheme zod + tipuri, importate de ambele părți
├── docs/
└── local/                    # credențiale — NU se commituie
```

Gestionar de pachete: **npm workspaces**, declarate în `package.json`-ul rădăcină.

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

enum Genre {
  FICTION
  SCIFI
  FANTASY
  THRILLER
  ROMANCE
  HISTORICAL
  MEMOIR
  NONFICTION
  SELF_HELP
  BUSINESS
  SCIENCE
  PHILOSOPHY
  PSYCHOLOGY
  POETRY
  COMICS_MANGA
  CHILDREN_YA
  OTHER
}

model Book {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // identity (user-input or Open Library)
  title        String
  author       String?
  isbn         String? // NOT unique — see D13
  totalPages   Int?    // frequently absent — see D4
  genre        Genre?
  olEditionKey String?

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

  manuallyEditedFields Json? // field names protected from refresh — see S4.4

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

  data      Bytes       @db.LongBlob
  mimeType  String
  source    CoverSource
  createdAt DateTime    @default(now())
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
| `GET /openlibrary/search?q=` | proxy peste Search API; returnează rezultate normalizate cu URL de miniatură |
| `GET /openlibrary/isbn/:isbn` | căutare după ISBN; returnează câmpurile completabile |
| `POST /books` | la creare, dacă vine cu `olEditionKey`, descarcă coperta și o salvează |
| `GET /covers/:bookId` | servește blob-ul, cu `Cache-Control: public, max-age=31536000, immutable` |

- **Debounce de 300ms** se aplică în frontend, înainte de a lovi propriul backend.
- **Nicio randare nu declanșează un apel extern.** După adăugare, cartea se afișează identic
  și dacă Open Library e complet indisponibil.
- **Works vs. editions (§D7):** Search API returnează *works*; la selecție, backendul rezolvă
  `cover_edition_key` pentru copertă, ISBN și număr de pagini.
- **Degradare grațioasă:** orice eroare externă întoarce un răspuns care lasă formularul manual
  complet funcțional. Open Library indisponibil nu blochează adăugarea unei cărți.

---

## Agregările (Sprinturile 6–8)

Toate valorile derivate din DECISIONS.md se calculează **în SQL, la cerere**, nu se stochează și
nu se recalculează în JavaScript peste toată biblioteca.

| Endpoint | Servește |
|---|---|
| `GET /stats/overview` | S7.1 și dashboard-ul S8.1 — aceleași cifre, aceeași sursă |
| `GET /stats/by-month` | S7.2, grupare pe `finishedOn` |
| `GET /budget/summary` | S6.1, S6.3 |
| `GET /budget/by-month` | S6.2, grupare pe `purchasedOn` |

Regula de agregare a paginilor (S7.1) trăiește într-un singur loc, în modulul `stats`.
Dashboard-ul consumă același endpoint ca pagina de statistici — altfel cele două ecrane ajung
inevitabil să afișeze cifre diferite.

Cărțile fără dată sunt excluse din grafice, dar numărate în răspuns, ca frontendul să poată
afișa avertismentul cerut de S6.2 și S7.2.

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
