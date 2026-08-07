# Bookcsi — Decizii de model și puncte deschise

Documentul acoperă găurile de definiție găsite la analiza logică a backlogului inițial.
Fiecare decizie de mai jos e deja reflectată în [USER_STORIES.md](USER_STORIES.md).
Un singur punct rămâne **DESCHIS** (D2) și blochează începerea Sprintului 1.

---

## Model de date

Identificatorii sunt în engleză peste tot — cod, bază de date, enum-uri. Româna apare doar în
textele afișate, prin mape de traducere. Vezi §D21.

### Entitatea `Book`

| Câmp | Tip | Sursă |
|---|---|---|
| `id` | cuid | System-generated |
| `userId` | fk → `User` | System-generated |
| `title` | text (obligatoriu) | User-input / Third-party |
| `author` | text | User-input / Third-party |
| `isbn` | text, nullable | User-input / Search-assisted |
| `totalPages` | int, nullable | Third-party / User-input |
| `genre` | enum din listă controlată, nullable | User-input |
| `cover` | relație 1:1 → `Cover`, nullable | Third-party (descărcată) / User-input (upload) |
| `olEditionKey` | text, nullable | Third-party |
| `status` | enum: WISHLIST, PURCHASED, READING, FINISHED, ABANDONED | User-input |
| `favorite` | bool | User-input |
| `pagesRead` | int, default 0 | User-input |
| `rating` | int 1–5, nullable | User-input |
| `estimatedPrice` | decimal, nullable | User-input |
| `paidPrice` | decimal, nullable | User-input |
| `createdAt` | timestamp | System-generated |
| `updatedAt` | timestamp | System-generated |
| `purchasedOn` | date, nullable | System-generated, user-overridable |
| `startedOn` | date, nullable | System-generated, user-overridable |
| `finishedOn` | date, nullable | System-generated, user-overridable |

`manuallyEditedFields` a fost eliminat odată cu S4.4 — vezi §D25.

### Entitatea `User`
`id` (cuid), `googleId` (unic), `email` (unic), `name`, `avatarUrl`, `createdAt`.
Toate populate din profilul Google la prima autentificare (S0.1).

### Entitatea `Cover`
`bookId` (PK, 1:1 cu `Book`), `data` (LONGBLOB), `mimeType`, `source` (OPEN_LIBRARY | UPLOAD),
`updatedAt`. Tabel separat din motivele de la §D18; `updatedAt` e versiunea din URL (§D26).

### Entitatea `Settings`
Una per utilizator: `userId` (PK), `monthlyBudget` (decimal, nullable),
`yearlyBudget` (decimal, nullable), `currency` (default RON).

### Valori derivate — nu se stochează niciodată
`progres_procent`, `total_cheltuit`, `total_pagini_citite`, `total_carti_citite`,
`rating_mediu`, `cost_total_wishlist`, `buget_ramas`.

---

## Corecții față de categorizarea inițială a surselor

**Genul literar** a fost mutat din *Third-party* în *User-input*. Motiv: Open Library nu
returnează un gen, ci `subjects` — liste libere de zeci până la sute de tag-uri în engleză,
inconsistente ca granularitate („Fiction", „American fiction", „New York Times bestseller").
Nu sunt utilizabile ca fațete de filtrare. Se folosesc doar ca sugestie la adăugare.

**S-a adăugat o categorie de sursă nouă:** *System-generated, user-overridable*. Acoperă cele
trei date de status (D1). Lipsea din categorizare, și exact lipsa ei bloca Epicele de buget și
statistici.

---

## Decizii luate

### D1 — Datele de status (era gaura majoră)
Backlogul inițial cerea „bani cheltuiți **în timp**" și „cărți citite **pe lună**", dar nu avea
în model nicio dată în afară de `data_adaugare`. Cele două nu sunt echivalente: o carte citită
în 2019 și introdusă azi ar fi apărut în statisticile lunii curente.

**Decizie:** `data_cumparare`, `data_start_lectura`, `data_terminare` — setate automat la
tranziția de status, editabile manual oricând.

### D2 — Persistență și conturi — rezolvat
Nicăieri în backlogul inițial nu se spunea unde trăiesc datele.

**Decizie:** persistență server-side în **MariaDB**, accesată prin Prisma (`provider = "mysql"`),
expusă de un backend NestJS. Aplicația e **multi-user**, cu autentificare prin **Google OAuth 2.0**
ca unică metodă de login.

Consecințe:
- Datele supraviețuiesc schimbării de browser și device.
- Aplicația necesită conexiune — nu există mod offline în MVP.
- Fiecare entitate e legată de un `userId`, iar orice interogare e filtrată pe utilizatorul
  autentificat (S0.3).
- Apare **Sprint 0**, singurul care nu livrează valoare de unul singur.

MariaDB în locul MongoDB-ului evaluat inițial: modelul e complet relațional, iar pe `mysql`
Prisma oferă `prisma migrate` cu istoric de migrări versionat în git — ceea ce conectorul de
MongoDB nu suportă (acolo există doar `db push`).

### D3 — Paginile citite: valoare curentă, nu istoric
Se stochează un singur `pagini_citite`. E suficient pentru progresul per carte și pentru
„cărți citite pe lună". Nu permite grafice de tip „pagini pe săptămână" — dacă acelea vor fi
vreodată dorite, e nevoie de o entitate `SesiuneLectura (data, pagina)`, iar schimbarea nu e
retroactivă (datele istorice nu se pot reconstrui). Decizia se ia acum tocmai din acest motiv.

### D4 — Lipsa numărului de pagini
`number_of_pages` lipsește frecvent din Open Library, mai ales pe edițiile non-engleze.
Fără el, procentul de progres e o împărțire la null.

**Decizie:** `total_pagini` e nullable. Când lipsește, se cere o dată la trecerea în `Citesc`
(cu skip permis), iar progresul se afișează ca „pag. 143" fără procent și fără bară.

### D5 — Rating mediu
Media se calculează doar peste cărțile care au rating. Includerea celor nerated ar trage media
în jos cu fiecare carte neevaluată.

### D6 — Două prețuri, nu unul
`pret_estimat` (wishlist, estimare proprie — Open Library nu furnizează prețuri) și
`pret_platit` (suma reală). Bugetul numără exclusiv `pret_platit`. Mutarea în „Cumpărat"
precompletează al doilea din primul.

### D7 — Works vs. editions în Open Library
Search API returnează *works*; coperta, ISBN-ul și numărul de pagini aparțin însă *edițiilor*.

**Decizie:** la selecția unui rezultat se ia automat ediția implicită (`cover_edition_key`).
Utilizatorul nu alege ediția — dar poate corecta orice câmp rezultat (S4.4).

### D8 — Coperta se stochează ca imagine, nu ca URL
Un URL către Open Library se rupe când serviciul e indisponibil, și ar necesita oricum un al
doilea mecanism pentru upload-urile manuale.

**Decizie:** imaginea se descarcă și se stochează local la momentul selecției. Rezolvă simultan
cerința de cache, funcționarea offline și upload-ul manual, cu un singur mecanism.

### D9 — Bugetul nu se reportează
Fiecare lună pornește de la bugetul complet; economiile nu se cumulează. E comportamentul
așteptat pentru un buget de tip „limită", nu de tip „portofel".

### D10 — „Pagini totale" e o singură metrică, definită o dată
Termenul apărea în trei locuri cu înțelesuri diferite (suma paginilor din bibliotecă vs. pagini
efectiv citite). Rămâne o singură metrică — „pagini citite" — cu regula de agregare din S7.1,
folosită identic pe dashboard și în pagina de statistici.

### D11 — Statusul „Abandonat"
Fluxul inițial era o săgeată fără ieșire. Fără o stare terminală de abandon, o carte lăsată
rămâne veșnic „Citesc" și denaturează atât progresul, cât și statisticile.

**Decizie:** `Abandonat` există, contribuie la „pagini citite" cu paginile parcurse, nu se
numără la „cărți citite", și poate primi rating.

### D12 — Fluxul de status nu e o constrângere
Orice status e setabil direct, în orice ordine, inclusiv înapoi (recitiri). Săgeata
Wishlist → Cumpărat → Citesc → Terminat determină doar butonul de acțiune sugerată.
Un flux strict liniar ar face imposibilă introducerea unei biblioteci deja existente.

### D13 — ISBN nu e cheie primară
O carte are ISBN-10, ISBN-13 și câte unul per ediție; în plus, aceeași carte poate exista
legitim de două ori. Cheia e `id`-ul intern; ISBN-ul e un simplu atribut. Duplicatele produc
un avertisment, nu un blocaj.

### D14 — Favorit e ortogonal statusului
Se poate marca favorită și o carte din wishlist. Filtrele din galerie se combină liber.

### D15 — Raftul vizual
Era complet nedefinit. Regulile sunt acum în S8.2: doar cărțile deținute, grosimea din numărul
de pagini, culoarea din gen, ordonare după data cumpărării.

### D16 — Monedă
O singură monedă globală, RON implicit, configurabilă în setări (story S6.4). Nu se face
conversie valutară: schimbarea monedei schimbă simbolul, nu recalculează sumele existente.

### D17 — Lista controlată de genuri
Genul e user-input dintr-o listă fixă, cu **o singură valoare per carte**. Multi-gen ar fi mai
fidel realității, dar complică filtrarea din S5.3 fără câștig real la scara unei biblioteci
personale.

Lista inițială (identificator → etichetă afișată):

`FICTION` → Ficțiune · `SCIFI` → SF · `FANTASY` → Fantasy · `THRILLER` → Thriller / Mister ·
`ROMANCE` → Romance · `HISTORICAL` → Roman istoric · `MEMOIR` → Biografie / Memorii ·
`NONFICTION` → Non-ficțiune · `SELF_HELP` → Dezvoltare personală · `BUSINESS` → Business /
Economie · `SCIENCE` → Științe · `PHILOSOPHY` → Filosofie · `PSYCHOLOGY` → Psihologie ·
`POETRY` → Poezie · `COMICS_MANGA` → Bandă desenată / Manga · `CHILDREN_YA` → Copii /
Young Adult · `OTHER` → Altele

Lista e o constantă în cod, nu o entitate în bază — nu există story de administrare a genurilor.
`Altele` există special ca să nu blocheze adăugarea unei cărți care nu se încadrează.
La adăugarea prin Open Library (S4.1), `subjects` se pot folosi pentru a **presugera** un gen din
listă, dar niciodată pentru a scrie direct valoarea.

### D18 — Unde stau coperțile, acum că există backend
D8 a stabilit *că* imaginea se stochează, nu URL-ul. Cu backend, apare întrebarea *unde*.

**Decizie:** binar în baza de date, într-un **tabel separat** `Coperta`, în relație 1:1 cu
`Carte`. Coloană `LONGBLOB`, plus `mimeType` și sursa (Open Library / upload manual).

Tabelul separat nu e cosmetic: Prisma nu are lazy loading, deci o copertă ținută pe rândul
`Carte` ar fi încărcată la fiecare listare a bibliotecii, chiar și când se afișează doar titluri.
Cu relație 1:1, blob-ul se citește doar când e cerut explicit.

Coperțile sunt de ordinul zecilor de KB, deci stocarea în baza de date păstrează backup-ul
atomic (un singur `mysqldump`, fără director de fișiere de sincronizat separat). Se servesc
printr-un endpoint dedicat, cu `Cache-Control` agresiv — coperta unei cărți nu se schimbă
niciodată după adăugare.

### D19 — Genurile devin enum în baza de date
D17 stabilea lista ca simplă constantă în cod, alegere făcută pe premisa MongoDB. Pe MariaDB,
lista devine un `enum` Prisma, deci și o constrângere reală în schemă. Rămâne totuși **enum, nu
tabel**: nu există story de administrare a genurilor, iar o modificare a listei e o migrare, nu
o operație de utilizator.

### D20 — Sesiune prin cookie httpOnly, nu token în localStorage
Un JWT ținut în `localStorage` e citibil din orice JavaScript injectat. Sesiunea se transportă
într-un cookie `httpOnly`, `Secure`, `SameSite=Lax`, iar frontendul nu are niciodată acces
programatic la ea. Cererile din React pornesc cu `credentials: "include"`.

Consecință în dev: frontendul (Vite, `:5173`) și API-ul (`:3000`) sunt origini diferite, deci
backendul are nevoie de CORS cu `credentials: true` și origine explicită — nu `*`.

### D21 — Codul în engleză, interfața în română
Toți identificatorii sunt în engleză: nume de fișiere, variabile, funcții, câmpuri de bază de
date, valori de enum, rute de API. Româna există exclusiv în textele văzute de utilizator.

Puntea o fac mape de traducere explicite (`STATUS_LABEL`, `GENRE_LABEL`), nu conversii implicite
și nici enum-uri cu valori românești. Avantajul practic: dacă apare vreodată o a doua limbă,
mapele sunt singurul lucru care se dublează — restul codului nu se atinge.

### D22 — Structura de monorepo
`frontend/` și `backend/` la rădăcină, nu `apps/web` și `apps/api`. Gestionar: npm workspaces,
declarate în `package.json`-ul rădăcină.

### D23 — Delogarea invalidează token-ul, prin `tokenVersion`
Ștergerea cookie-ului ia doar copia din browser. Token-ul e semnat și se verifică singur, deci
orice copie făcută înainte de delogare rămâne valabilă încă 30 de zile — delogarea „reușea"
fără să încheie sesiunea.

`User` are un contor `tokenVersion`. Fiecare token poartă valoarea de la semnare, iar
`JwtStrategy` refuză token-ul a cărui valoare a rămas în urmă. Delogarea incrementează
contorul. Verificarea nu costă nimic în plus: strategia interoga oricum rândul la fiecare
cerere, ca să confirme că utilizatorul mai există.

**Un singur contor per utilizator, deci delogarea închide sesiunile de pe toate
dispozitivele.** Revocarea per-dispozitiv cere un tabel de sesiuni active, adică o funcționalitate
în sine — S0.2 cere o delogare explicită care chiar funcționează, nu managementul sesiunilor.

Ruta rămâne `@Public()`: un tab cu sesiunea deja expirată trebuie să se poată deloga. Citește
cookie-ul „pe cât se poate" — un token care nu se verifică pur și simplu n-are ce revoca.

### D24 — Parametrul `state` la OAuth, într-un cookie propriu
Fără el, callback-ul acceptă orice cod de autorizare care ajunge la el. Un atacator parcurge
fluxul Google cu contul lui, se oprește înainte de ultimul redirect și determină browserul
victimei să viziteze callback-ul cu acel cod: victima e autentificată în tăcere **ca atacatorul**,
iar cărțile pe care le adaugă ajung în biblioteca lui. Nimic nu pare stricat, și tocmai de-asta
merită apărat.

Se generează un nonce la pornirea fluxului, se trimite la Google ca să fie returnat identic, și
se ține între timp într-un cookie `httpOnly` cu viață scurtă, limitat la `/auth`. Callback-ul
compară cele două **înainte** să ruleze passport, deci un callback falsificat e refuzat fără ca
codul lui să fie vreodată schimbat cu Google. Cookie-ul se șterge în ambele cazuri: nonce-ul e
de unică folosință.

Passport știe să facă asta singur, dar numai printr-un session store, iar §D20 rulează passport
cu `session: false` — sesiunea *e* cookie-ul JWT. De aceea nonce-ul primește un cookie al lui.

### D25 — S4.4 se elimină: nu există reîmprospătare
S4.4 cerea ca un câmp editat manual să fie marcat și să nu mai fie suprascris „de o eventuală
reîmprospătare ulterioară a datelor externe".

Partea de story era deja livrată de S1.3 — orice câmp e editabil oricând, indiferent de sursa
care l-a populat. Iar reîmprospătarea nu există: niciun story din Sprinturile 0–8 sau din
backlogul opțional nu recitește datele unei cărți din Open Library. Coloana s-ar fi scris la
fiecare editare și nu s-ar fi citit niciodată.

**Decizie:** story-ul se taie, nu se amână, iar `manuallyEditedFields` iese din schemă. Dacă
apare vreodată un story de refresh, se reintroduce împreună cu el — atunci va avea un cititor.

### D26 — Coperta e `immutable`, deci URL-ul poartă o versiune
§D18 servește coperta cu `Cache-Control: max-age=1 an, immutable`, pe premisa că nu se schimbă
niciodată după adăugare. Upload-ul manual din S4.3 e exact premisa aceea căzând: la înlocuirea
unei coperți, browserul — respectând corect `immutable` — ar păstra imaginea veche un an.

**Decizie:** `Cover.updatedAt` intră în URL ca `?v=`, iar `Book.coverUrl` îl livrează gata
compus. O copertă înlocuită devine astfel pur și simplu un URL pe care cache-ul nu l-a văzut
niciodată. Alternativa — slăbirea cache-ului pentru toată lumea — ar plăti pentru un caz care
apare cel mult o dată per carte.

Consecință: clientul nu construiește niciodată URL-ul coperții singur. Îl ia din `coverUrl`,
altfel versiunea e primul lucru care se pierde.

### D27 — Erorile se împart după ce poate face utilizatorul, nu după a cui e vina
Convenția exista în practică, dar nescrisă: aproape toate erorile acționabile aveau deja
mesaj în română, iar erorile interne ajungeau 500 generic — dar pentru că așa face Nest din
oficiu, nu pentru că ar fi decis cineva. Nu exista niciun cod de eroare nicăieri, iar clientul
ramifica pe status HTTP.

**Decizie.** O singură întrebare împarte erorile: *poate utilizatorul face ceva în privința
asta?*

- **Da** → `AppError` pe server: o propoziție scrisă pentru el, plus un `code` din lista din
  `shared/errors.ts`. Mesajul se afișează verbatim; codul e pentru clientul care trebuie să
  **ramifice**, nu doar să afișeze.
- **Nu** → `Error` obișnuit. Filtrul global îl transformă în 500 gol: fără cod, fără mesaj,
  fără nimic despre interiorul serverului.

**Codul e discriminatorul, nu statusul.** Asta e tot rostul lui. Alternativa evidentă —
„arată mesajul dacă statusul e sub 500" — e greșită într-un fel ușor de ratat: **statusurile
HTTP răspund la «a cui e vina», iar convenția asta întreabă «ce poate face utilizatorul»**.
Cele două întrebări dau răspunsuri diferite exact pentru o indisponibilitate externă, care nu
e vina clientului (deci 5xx) dar e complet acționabilă („Open Library e picat, scrie tu
cartea"). Cu regula pe status, fix acel mesaj se pierde — și chiar s-a pierdut: în Sprint 4
mesajul de 503 al backendului n-a ajuns niciodată la utilizator, iar cele două componente au
ajuns să-și scrie propriile variante ale aceleiași propoziții.

**Filtrul aplică regula, nu doar o documentează.** `AppExceptionFilter` rescrie orice 5xx
**fără cod**, oricât de vorbăreț ar fi. Nimic din TypeScript nu împiedică
`new InternalServerErrorException(err.message)`, iar fără filtru Nest ar pune fidel părerea
driverului despre string-ul de conexiune pe ecranul cuiva. Convenția nu se mai poate încălca
în tăcere — doar deliberat, aruncând un `AppError`.

Consecințe:
- 429 primește cod aici (`ThrottlerException` vine din bibliotecă, deci n-are cum să-l aducă
  singur), la fel și 401 — ridicat de passport și de guard-urile Nest, niciodată de codul
  nostru.
- Clientul a scăpat de toate ramificările pe status: `errorMessage(error, fallback)` decide
  o singură dată, iar componenta dă doar propoziția pentru cazul fără cuvinte proprii (eroare
  de rețea, care n-a ajuns niciodată la API).
- Un cod necunoscut e ignorat la citire. Vine de pe rețea; nu se promovează singur în „serverul
  zice că se poate afișa".

---

## Ce a fost eliminat din backlogul inițial

- **Cele două story-uri „ca developer"** (cache pe Covers API, fallback Google Books). Primul
  nu era un story, ci o constrângere — a devenit criteriu de acceptanță transversal pentru
  Sprint 4 și decizia D8. Al doilea a fost eliminat la cerere: Open Library rămâne singura sursă
  externă.
- **S4.4 — „suprascriu manual orice câmp automat"**, tăiat la începutul Sprintului 4: era
  S1.3 repetat, plus un criteriu care apăra împotriva unei funcționalități inexistente (§D25).

## Ce a fost adăugat

- **S1.3 — editare și ștergere.** Backlogul inițial nu avea niciun story de delete, deci CRUD-ul
  era incomplet.
- **S1.5 — datele de status** (D1).
- **S1.6 — persistență** (D2).
- **S6.4 — alegerea monedei** (D16).
- **O.1 — export/import**, în backlogul opțional.
- **Statusul `Abandonat`** (D11).
